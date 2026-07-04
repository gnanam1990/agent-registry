/**
 * The read-only dashboard page — a single self-contained HTML document. Dark, violet
 * accent, mono for addresses/amounts/hashes; reuses the arcpayments design language.
 * It fetches `/api/state` and renders live on-chain state. No wallet, no writes, no
 * keys — it only reads the three verified contracts. Honest empty/error states;
 * responsive; `prefers-reduced-motion` respected.
 */
export function renderDashboardPage(): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>agent-registry · Arc testnet</title>
<link rel="preconnect" href="https://fonts.googleapis.com" />
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
<link href="https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
:root {
  --ink: #14121c; --surface: #1c1a28; --surface-2: #232032; --line: #322e46;
  --text: #eceaf4; --muted: #9a93b4; --violet: #8b6dff; --violet-dim: #5b48b8;
  --amber: #e0a24e; --mint: #4fd8a6; --rose: #f2678c; --radius: 12px;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --display: "Space Grotesk", ui-sans-serif, system-ui, sans-serif;
  --body: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body { background: radial-gradient(1100px 520px at 84% -12%, rgba(139,109,255,0.10), transparent 60%), var(--ink);
  color: var(--text); font-family: var(--body); line-height: 1.5; -webkit-font-smoothing: antialiased; min-height: 100vh; }
.wrap { max-width: 1080px; margin: 0 auto; padding: 28px 20px 64px; }
a { color: var(--violet); text-decoration: none; }
a:hover { text-decoration: underline; }

.top { display: flex; align-items: baseline; justify-content: space-between; gap: 16px; flex-wrap: wrap; margin-bottom: 8px; }
.wordmark { font-family: var(--display); font-weight: 700; font-size: 21px; letter-spacing: -0.01em; }
.wordmark .dot { color: var(--violet); }
.eyebrow { font-size: 12px; color: var(--muted); }
.live { display: inline-flex; align-items: center; gap: 7px; font-family: var(--mono); font-size: 11px; color: var(--muted); }
.live .pulse { width: 7px; height: 7px; border-radius: 50%; background: var(--mint); animation: pulse 2.4s ease-out infinite; }
@keyframes pulse { 0% { box-shadow: 0 0 0 0 rgba(79,216,166,0.45); } 70% { box-shadow: 0 0 0 7px rgba(79,216,166,0); } 100% { box-shadow: 0 0 0 0 rgba(79,216,166,0); } }

.contracts { display: flex; gap: 8px; flex-wrap: wrap; margin: 14px 0 22px; }
.cc { font-family: var(--mono); font-size: 11px; color: var(--muted); border: 1px solid var(--line); border-radius: 999px; padding: 5px 11px; }
.cc b { color: var(--text); font-weight: 500; }

.err { background: color-mix(in srgb, var(--rose) 12%, var(--surface)); border: 1px solid color-mix(in srgb, var(--rose) 40%, transparent);
  color: var(--text); border-radius: var(--radius); padding: 14px 16px; margin-bottom: 20px; font-size: 14px; }

.stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; margin-bottom: 24px; }
.stat { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); padding: 16px; }
.stat .n { font-family: var(--mono); font-size: 28px; font-weight: 600; letter-spacing: -0.02em; }
.stat .l { font-size: 12px; color: var(--muted); margin-top: 2px; }
.stat .sub { font-family: var(--mono); font-size: 11px; color: var(--muted); margin-top: 6px; }

.eyebrow-label { font-size: 11px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--muted); font-weight: 600; margin: 26px 0 12px; }
.card { background: var(--surface); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }
.row { display: grid; gap: 12px; align-items: center; padding: 13px 16px; border-top: 1px solid var(--line); }
.row:first-child { border-top: none; }
.agents .row { grid-template-columns: 1fr auto; }
.attests .row { grid-template-columns: 1fr auto; }
.escrows .row { grid-template-columns: 44px 1fr auto auto; }
.mono { font-family: var(--mono); }
.addr { font-family: var(--mono); font-size: 13px; }
.meta { font-size: 12px; color: var(--muted); margin-top: 3px; word-break: break-all; }
.rep { font-family: var(--mono); font-size: 12px; color: var(--violet); border: 1px solid color-mix(in srgb, var(--violet) 40%, transparent); border-radius: 999px; padding: 3px 9px; white-space: nowrap; }
.rep.zero { color: var(--muted); border-color: var(--line); }
.amt { font-family: var(--mono); font-weight: 600; }
.amt .u { color: var(--muted); font-weight: 400; font-size: 12px; margin-left: 4px; }
.arrow { color: var(--muted); }
.pill { font-family: var(--mono); font-size: 11px; padding: 3px 10px; border-radius: 999px; border: 1px solid transparent; white-space: nowrap; }
.p-open { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 40%, transparent); }
.p-released { color: var(--mint); border-color: color-mix(in srgb, var(--mint) 45%, transparent); }
.p-refunded { color: var(--rose); border-color: color-mix(in srgb, var(--rose) 40%, transparent); }
.id { font-family: var(--mono); font-size: 12px; color: var(--muted); }
.empty { padding: 26px 16px; color: var(--muted); font-size: 14px; text-align: center; }
.empty code { font-family: var(--mono); color: var(--text); background: var(--surface-2); border: 1px solid var(--line); border-radius: 6px; padding: 2px 7px; }
.foot { color: var(--muted); font-size: 12px; margin-top: 26px; border-top: 1px solid var(--line); padding-top: 14px; }
:focus-visible { outline: 2px solid var(--violet); outline-offset: 2px; border-radius: 4px; }

@media (max-width: 720px) {
  .stats { grid-template-columns: repeat(2, 1fr); }
  .escrows .row { grid-template-columns: 36px 1fr auto; }
  .escrows .row .arrowcol { display: none; }
}
@media (prefers-reduced-motion: reduce) { .live .pulse { animation: none; } }
</style>
</head>
<body>
<div class="wrap">
  <header class="top">
    <div>
      <div class="wordmark">agent-registry<span class="dot">.</span></div>
      <div class="eyebrow">Arc testnet · read-only · community project, not affiliated with Circle/Arc</div>
    </div>
    <span class="live"><span class="pulse"></span><span id="live">loading…</span></span>
  </header>
  <div class="contracts" id="contracts"></div>

  <div id="err"></div>

  <section class="stats" id="stats"></section>

  <p class="eyebrow-label">Agents</p>
  <div class="card agents" id="agents"></div>

  <p class="eyebrow-label">Attestations · reputation</p>
  <div class="card attests" id="attests"></div>

  <p class="eyebrow-label">Escrows</p>
  <div class="card escrows" id="escrows"></div>

  <p class="foot" id="foot"></p>
</div>

<script>
const $ = (id) => document.getElementById(id);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
let EXPLORER = "https://testnet.arcscan.app";
const link = (addr) => { const a = el("a", "addr", addr); a.href = EXPLORER + "/address/" + addr; a.target = "_blank"; a.rel = "noreferrer"; return a; };
const timeAgo = (s) => { if (!s) return ""; const d = Date.now()/1000 - s; if (d < 90) return "just now"; if (d < 3600) return Math.floor(d/60)+"m ago"; if (d < 86400) return Math.floor(d/3600)+"h ago"; return Math.floor(d/86400)+"d ago"; };

function emptyCard(box, msg, cmd) {
  const e = el("div", "empty");
  e.append(el("div", null, msg));
  if (cmd) { const c = el("div"); c.style.marginTop = "10px"; const code = el("code"); code.textContent = cmd; c.append(code); e.append(c); }
  box.append(e);
}

function render(m) {
  EXPLORER = m.explorer || EXPLORER;
  $("live").textContent = "live";

  const cc = $("contracts"); cc.replaceChildren();
  for (const [k, v] of Object.entries(m.contracts)) {
    const chip = el("span", "cc"); const b = el("b", null, k + " "); chip.append(b, link(v)); cc.append(chip);
  }

  $("err").replaceChildren();
  if (m.error) { const e = el("div", "err", m.error); $("err").append(e); }

  const stats = $("stats"); stats.replaceChildren();
  const mk = (n, l, sub) => { const s = el("div", "stat"); s.append(el("div", "n", String(n)), el("div", "l", l)); if (sub) s.append(el("div", "sub", sub)); return s; };
  stats.append(
    mk(m.stats.agents, "Registered agents"),
    mk(m.stats.attestations, "Attestations"),
    mk(m.stats.open + m.stats.released + m.stats.refunded, "Escrows", m.stats.open + " open · " + m.stats.released + " released · " + m.stats.refunded + " refunded"),
    mk(m.contracts.usdc ? "USDC" : "—", "Escrow asset", "6 decimals"),
  );

  // agents
  const ag = $("agents"); ag.replaceChildren();
  if (!m.agents.length) emptyCard(ag, "No agents registered yet.", "cast send $REGISTRY 'registerAgent(string)' ipfs://you");
  else for (const a of m.agents) {
    const row = el("div", "row");
    const l = el("div"); l.append(link(a.address)); const meta = el("div", "meta", a.metadataURI); l.append(meta);
    const r = el("div"); r.style.textAlign = "right";
    const rep = el("span", "rep" + (a.reputation ? "" : " zero"), a.reputation + (a.reputation === 1 ? " attestation" : " attestations"));
    r.append(rep); const t = el("div", "meta", "registered " + timeAgo(a.registeredAt)); t.style.marginTop = "6px"; r.append(t);
    row.append(l, r); ag.append(row);
  }

  // attestations
  const at = $("attests"); at.replaceChildren();
  if (!m.attestations.length) emptyCard(at, "No attestations yet. A registered agent can vouch for another.");
  else for (const x of m.attestations) {
    const row = el("div", "row");
    const l = el("div"); l.append(link(x.attester)); const arrow = el("span", "arrow", "  →  "); const sub = link(x.subject);
    const line = el("div", "addr"); line.append(link(x.attester), el("span", "arrow", "  →  "), link(x.subject));
    const d = el("div", "meta", "data " + x.data.slice(0, 10) + "… · " + timeAgo(x.at));
    l.replaceChildren(line, d);
    row.append(l, el("div"));
    at.append(row);
  }

  // escrows
  const es = $("escrows"); es.replaceChildren();
  if (!m.escrows.length) emptyCard(es, "No escrows yet. A payer can deposit USDC for a registered agent.");
  else for (const e of m.escrows) {
    const row = el("div", "row");
    row.append(el("div", "id", "#" + e.id));
    const parties = el("div", "addr"); parties.append(link(e.payer), el("span", "arrow arrowcol", "  →  "), link(e.payee));
    const amt = el("div", "amt"); amt.append(document.createTextNode(e.amount), el("span", "u", "USDC"));
    const pill = el("span", "pill p-" + e.status, e.status);
    row.append(parties, amt, pill); es.append(row);
  }

  $("foot").textContent = "Read directly from the three verified contracts on Arc testnet — no wallet, no writes. Updated " + timeAgo(m.generatedAt || Math.floor(Date.now()/1000)) + ".";
}

async function boot() {
  try { const res = await fetch("/api/state"); render(await res.json()); }
  catch (e) { $("live").textContent = "offline"; $("err").append(el("div", "err", "Couldn't reach the dashboard server.")); }
}
boot();
setInterval(boot, 15000);
</script>
</body>
</html>`;
}
