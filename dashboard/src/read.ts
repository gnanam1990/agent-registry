import { type AbiEvent, formatUnits, getAddress, type PublicClient, parseAbiItem } from "viem";
import { addresses, deployBlock, explorer, LOG_RANGE, usdcDecimals } from "./config.ts";

/** A getLogs result decoded against an event — `args` carries the indexed + data fields. */
type DecodedLog = { args: Record<string, unknown> };

/**
 * Read the live on-chain state of the three contracts and assemble the dashboard
 * model. Enumeration is done purely from EVENT LOGS (the contracts hold no arrays,
 * by design) — AgentRegistered/Updated, Attested, EscrowCreated/Released/Refunded.
 * Read-only: no keys, no writes. `assembleModel` is a pure function (unit-tested);
 * `readOnChain` is the thin network layer.
 */

// ---- log shapes (decoded) ----
export interface RegisteredLog {
  agent: string;
  metadataURI: string;
  timestamp: bigint;
}
export interface AttestedLog {
  attester: string;
  subject: string;
  data: string;
  timestamp: bigint;
}
export interface CreatedLog {
  id: bigint;
  payer: string;
  payee: string;
  amount: bigint;
  deadline: bigint;
}

export interface ModelInput {
  registered: RegisteredLog[];
  updated: RegisteredLog[]; // AgentUpdated shares the shape
  attested: AttestedLog[];
  created: CreatedLog[];
  releasedIds: bigint[];
  refundedIds: bigint[];
  now: number;
}

// ---- view model ----
export type EscrowStatus = "open" | "released" | "refunded";

export interface AgentView {
  address: string;
  short: string;
  metadataURI: string;
  registeredAt: number;
  reputation: number; // attestations received
  link: string;
}
export interface AttestationView {
  attester: string;
  attesterShort: string;
  subject: string;
  subjectShort: string;
  data: string;
  at: number;
}
export interface EscrowView {
  id: number;
  payer: string;
  payerShort: string;
  payee: string;
  payeeShort: string;
  amount: string; // formatted USDC
  amountRaw: string;
  deadline: number;
  status: EscrowStatus;
}
export interface DashboardModel {
  network: string;
  explorer: string;
  contracts: { registry: string; attestations: string; escrow: string; usdc: string };
  agents: AgentView[];
  attestations: AttestationView[];
  escrows: EscrowView[];
  stats: { agents: number; attestations: number; open: number; released: number; refunded: number };
  generatedAt: number;
  error?: string;
}

export function truncate(addr: string): string {
  const a = getAddress(addr);
  return `${a.slice(0, 6)}…${a.slice(-4)}`;
}

function toSeconds(ts: bigint): number {
  return Number(ts);
}

/** Pure: assemble the model from decoded logs. Newest first; reputation = attestations received. */
export function assembleModel(input: ModelInput): DashboardModel {
  // latest metadata per agent (an AgentUpdated overrides the registration URI)
  const latestMeta = new Map<string, string>();
  for (const r of input.registered) latestMeta.set(getAddress(r.agent), r.metadataURI);
  for (const u of [...input.updated].sort((a, b) => toSeconds(a.timestamp) - toSeconds(b.timestamp))) {
    latestMeta.set(getAddress(u.agent), u.metadataURI);
  }

  const reputation = new Map<string, number>();
  for (const a of input.attested) {
    const s = getAddress(a.subject);
    reputation.set(s, (reputation.get(s) ?? 0) + 1);
  }

  const agents: AgentView[] = input.registered
    .map((r) => {
      const address = getAddress(r.agent);
      return {
        address,
        short: truncate(address),
        metadataURI: latestMeta.get(address) ?? r.metadataURI,
        registeredAt: toSeconds(r.timestamp),
        reputation: reputation.get(address) ?? 0,
        link: `${explorer}/address/${address}`,
      };
    })
    .sort((a, b) => b.registeredAt - a.registeredAt);

  const attestations: AttestationView[] = input.attested
    .map((a) => ({
      attester: getAddress(a.attester),
      attesterShort: truncate(a.attester),
      subject: getAddress(a.subject),
      subjectShort: truncate(a.subject),
      data: a.data,
      at: toSeconds(a.timestamp),
    }))
    .sort((a, b) => b.at - a.at);

  const released = new Set(input.releasedIds.map((i) => i.toString()));
  const refunded = new Set(input.refundedIds.map((i) => i.toString()));
  const escrows: EscrowView[] = input.created
    .map((e) => {
      const key = e.id.toString();
      const status: EscrowStatus = refunded.has(key)
        ? "refunded"
        : released.has(key)
          ? "released"
          : "open";
      return {
        id: Number(e.id),
        payer: getAddress(e.payer),
        payerShort: truncate(e.payer),
        payee: getAddress(e.payee),
        payeeShort: truncate(e.payee),
        amount: formatUnits(e.amount, usdcDecimals),
        amountRaw: e.amount.toString(),
        deadline: toSeconds(e.deadline),
        status,
      };
    })
    .sort((a, b) => b.id - a.id);

  return {
    network: "Arc testnet",
    explorer,
    contracts: {
      registry: addresses.registry,
      attestations: addresses.attestations,
      escrow: addresses.escrow,
      usdc: addresses.usdc,
    },
    agents,
    attestations,
    escrows,
    stats: {
      agents: agents.length,
      attestations: attestations.length,
      open: escrows.filter((e) => e.status === "open").length,
      released: escrows.filter((e) => e.status === "released").length,
      refunded: escrows.filter((e) => e.status === "refunded").length,
    },
    generatedAt: input.now,
  };
}

// ---- event ABIs for getLogs ----
const AgentRegistered = parseAbiItem(
  "event AgentRegistered(address indexed agent, string metadataURI, uint256 timestamp)",
);
const AgentUpdated = parseAbiItem(
  "event AgentUpdated(address indexed agent, string metadataURI, uint256 timestamp)",
);
const Attested = parseAbiItem(
  "event Attested(address indexed attester, address indexed subject, bytes32 data, uint256 timestamp)",
);
const EscrowCreated = parseAbiItem(
  "event EscrowCreated(uint256 indexed id, address indexed payer, address indexed payee, uint256 amount, uint64 deadline)",
);
const EscrowReleased = parseAbiItem("event EscrowReleased(uint256 indexed id, address indexed payee, uint256 amount)");
const EscrowRefunded = parseAbiItem("event EscrowRefunded(uint256 indexed id, address indexed payer, uint256 amount)");

/**
 * Fetch an event's logs from `deployBlock` to `latest`, in windows under Arc's
 * 10,000-block `eth_getLogs` cap. (Only ~5k blocks today, but this keeps working as
 * the chain grows.)
 */
async function getLogsChunked(
  client: PublicClient,
  address: `0x${string}`,
  event: AbiEvent,
  latest: bigint,
): Promise<DecodedLog[]> {
  const out: DecodedLog[] = [];
  for (let from = deployBlock; from <= latest; from += LOG_RANGE) {
    const to = from + LOG_RANGE - 1n > latest ? latest : from + LOG_RANGE - 1n;
    const logs = await client.getLogs({ address, event, fromBlock: from, toBlock: to });
    out.push(...(logs as unknown as DecodedLog[]));
  }
  return out;
}

/** Fetch logs from chain and assemble the model. Returns an error-carrying model if the RPC fails. */
export async function readOnChain(client: PublicClient, now: number): Promise<DashboardModel> {
  try {
    const latest = await client.getBlockNumber();
    const [registered, updated, attested, created, released, refunded] = await Promise.all([
      getLogsChunked(client, addresses.registry, AgentRegistered, latest),
      getLogsChunked(client, addresses.registry, AgentUpdated, latest),
      getLogsChunked(client, addresses.attestations, Attested, latest),
      getLogsChunked(client, addresses.escrow, EscrowCreated, latest),
      getLogsChunked(client, addresses.escrow, EscrowReleased, latest),
      getLogsChunked(client, addresses.escrow, EscrowRefunded, latest),
    ]);

    return assembleModel({
      registered: registered.map((l) => ({
        agent: l.args.agent as string,
        metadataURI: l.args.metadataURI as string,
        timestamp: l.args.timestamp as bigint,
      })),
      updated: updated.map((l) => ({
        agent: l.args.agent as string,
        metadataURI: l.args.metadataURI as string,
        timestamp: l.args.timestamp as bigint,
      })),
      attested: attested.map((l) => ({
        attester: l.args.attester as string,
        subject: l.args.subject as string,
        data: l.args.data as string,
        timestamp: l.args.timestamp as bigint,
      })),
      created: created.map((l) => ({
        id: l.args.id as bigint,
        payer: l.args.payer as string,
        payee: l.args.payee as string,
        amount: l.args.amount as bigint,
        deadline: l.args.deadline as bigint,
      })),
      releasedIds: released.map((l) => l.args.id as bigint),
      refundedIds: refunded.map((l) => l.args.id as bigint),
      now,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return {
      network: "Arc testnet",
      explorer,
      contracts: {
        registry: addresses.registry,
        attestations: addresses.attestations,
        escrow: addresses.escrow,
        usdc: addresses.usdc,
      },
      agents: [],
      attestations: [],
      escrows: [],
      stats: { agents: 0, attestations: 0, open: 0, released: 0, refunded: 0 },
      generatedAt: now,
      error: `Couldn't read Arc testnet (${message}). Check the RPC and try again.`,
    };
  }
}
