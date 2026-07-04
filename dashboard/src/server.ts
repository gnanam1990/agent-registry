import http from "node:http";
import { createClient } from "./config.ts";
import { renderDashboardPage } from "./page.ts";
import { readOnChain } from "./read.ts";

/**
 * Read-only dashboard server. `/` serves the page; `/api/state` returns the live
 * on-chain model (cached briefly so refreshes don't hammer the RPC). GET-only — it
 * never signs, never writes, never touches a key.
 */
export interface DashboardServerOptions {
  cacheTtlMs?: number;
}

export function createDashboardServer(options: DashboardServerOptions = {}): http.Server {
  const page = renderDashboardPage();
  const client = createClient();
  const ttl = options.cacheTtlMs ?? 8000;
  let cache: { model: unknown; at: number } | undefined;

  async function model(): Promise<unknown> {
    const now = Date.now();
    if (cache && now - cache.at < ttl) return cache.model;
    const m = await readOnChain(client, Math.floor(now / 1000));
    cache = { model: m, at: now };
    return m;
  }

  return http.createServer(async (req, res) => {
    const url = (req.url ?? "/").split("?")[0];
    if (req.method !== "GET") {
      res.writeHead(405, { allow: "GET" }).end();
      return;
    }
    if (url === "/" || url === "/index.html") {
      res.writeHead(200, { "content-type": "text/html; charset=utf-8", "cache-control": "no-store" });
      res.end(page);
      return;
    }
    if (url === "/api/state") {
      try {
        const m = await model();
        res.writeHead(200, { "content-type": "application/json", "cache-control": "no-store" });
        res.end(JSON.stringify(m, (_, v) => (typeof v === "bigint" ? v.toString() : v)));
      } catch (err) {
        res.writeHead(500, { "content-type": "application/json" });
        res.end(JSON.stringify({ error: err instanceof Error ? err.message : "read error" }));
      }
      return;
    }
    res.writeHead(404, { "content-type": "text/plain" });
    res.end("not found");
  });
}
