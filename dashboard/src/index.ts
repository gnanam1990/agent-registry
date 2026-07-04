import { rpcUrl } from "./config.ts";
import { createDashboardServer } from "./server.ts";

/**
 * Run the read-only agent-registry dashboard. Reads the three verified Arc-testnet
 * contracts via viem and serves a dark/violet page. No wallet, no keys, no writes.
 *
 *   bun run src/index.ts        # then open http://127.0.0.1:4025
 */
const port = Number(process.env.PORT ?? "4025");
const server = createDashboardServer();
server.listen(port, "127.0.0.1", () => {
  process.stdout.write(`agent-registry dashboard → http://127.0.0.1:${port}  (reading ${rpcUrl})\n`);
});
