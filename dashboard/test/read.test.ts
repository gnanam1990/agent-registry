import { describe, expect, it } from "bun:test";
import { assembleModel, type ModelInput, truncate } from "../src/read.ts";

const A = "0x4f5316bc860eb9f88068bfe2a61dc1dc026742bc";
const B = "0xb44aa52746b50ba1f95c49561270fa86eab2c7b8";

function input(over: Partial<ModelInput> = {}): ModelInput {
  return {
    registered: [
      { agent: A, metadataURI: "ipfs://agent-a", timestamp: 100n },
      { agent: B, metadataURI: "ipfs://agent-b", timestamp: 200n },
    ],
    updated: [],
    attested: [{ attester: A, subject: B, data: `0x${"1".repeat(64)}`, timestamp: 300n }],
    created: [{ id: 0n, payer: A, payee: B, amount: 1_000_000n, deadline: 999n }],
    releasedIds: [0n],
    refundedIds: [],
    now: 1000,
    ...over,
  };
}

describe("truncate", () => {
  it("checksums + shortens an address", () => {
    expect(truncate(A)).toBe("0x4f53…42Bc");
  });
});

describe("assembleModel", () => {
  it("lists agents newest-first with reputation = attestations received", () => {
    const m = assembleModel(input());
    expect(m.agents.map((a) => a.short)).toEqual(["0xB44A…C7b8", "0x4f53…42Bc"]); // B (t=200) before A (t=100)
    const b = m.agents.find((a) => a.address.toLowerCase() === B);
    expect(b?.reputation).toBe(1); // B was attested once
    const a = m.agents.find((x) => x.address.toLowerCase() === A);
    expect(a?.reputation).toBe(0);
    expect(a?.metadataURI).toBe("ipfs://agent-a");
    expect(a?.link).toContain("/address/");
  });

  it("an AgentUpdated overrides the registration metadata URI", () => {
    const m = assembleModel(
      input({ updated: [{ agent: A, metadataURI: "ipfs://agent-a-v2", timestamp: 400n }] }),
    );
    expect(m.agents.find((x) => x.address.toLowerCase() === A)?.metadataURI).toBe("ipfs://agent-a-v2");
  });

  it("formats escrow amount as 6-decimal USDC and derives status", () => {
    const m = assembleModel(input());
    expect(m.escrows).toHaveLength(1);
    expect(m.escrows[0]!.amount).toBe("1"); // 1_000_000 base units = $1.00
    expect(m.escrows[0]!.status).toBe("released");
    expect(m.escrows[0]!.payeeShort).toBe("0xB44A…C7b8");
  });

  it("escrow status precedence: refunded > released > open", () => {
    expect(assembleModel(input({ releasedIds: [], refundedIds: [] })).escrows[0]!.status).toBe("open");
    expect(assembleModel(input({ releasedIds: [0n], refundedIds: [0n] })).escrows[0]!.status).toBe(
      "refunded",
    );
  });

  it("computes stats and handles the empty case honestly", () => {
    const full = assembleModel(input());
    expect(full.stats).toMatchObject({ agents: 2, attestations: 1, released: 1, open: 0, refunded: 0 });

    const empty = assembleModel(input({ registered: [], attested: [], created: [], releasedIds: [] }));
    expect(empty.stats.agents).toBe(0);
    expect(empty.agents).toEqual([]);
    expect(empty.escrows).toEqual([]);
    expect(empty.error).toBeUndefined();
  });
});
