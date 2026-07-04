/**
 * The read-only dashboard page — a single self-contained HTML document. Deep-slate
 * institutional/fintech register, teal accent (#3DD8C4), mono for addresses / hashes
 * / amounts. It fetches `/api/state` and renders live on-chain state from the three
 * verified contracts. No wallet, no writes, no keys — reads only.
 *
 * Motion is subtle and professional (count-up metrics, breathing live-dot, staggered
 * card reveal, an animated attestation flow line, a soft pulse on the RELEASED badge)
 * and FULLY disabled under `prefers-reduced-motion`: the base stylesheet is the final,
 * static, visible state; all initial-hidden states + keyframes live only inside the
 * `no-preference` media query, so reduced-motion users never get stuck mid-animation.
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
<link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap" rel="stylesheet" />
<style>
:root {
  --bg: #0E141A; --panel: #17212B; --panel-2: #1E2A35; --line: #26333F;
  --line-soft: #202b36; --text: #E6EDF3; --muted: #8595A3; --faint: #5f6f7c;
  --teal: #3DD8C4; --teal-ink: #0c3b36; --amber: #E0A24E; --rose: #F2678C;
  --radius: 14px; --radius-sm: 9px;
  --mono: "IBM Plex Mono", ui-monospace, "SF Mono", Menlo, monospace;
  --ui: "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
}
* { box-sizing: border-box; }
html, body { margin: 0; }
body {
  background:
    radial-gradient(1200px 560px at 82% -18%, rgba(61,216,196,0.08), transparent 62%),
    radial-gradient(900px 520px at 8% -8%, rgba(61,216,196,0.045), transparent 60%),
    var(--bg);
  color: var(--text); font-family: var(--ui); line-height: 1.5;
  -webkit-font-smoothing: antialiased; text-rendering: optimizeLegibility; min-height: 100vh;
}
.wrap { max-width: 1120px; margin: 0 auto; padding: 34px 22px 72px; }
a { color: var(--teal); text-decoration: none; }
a:hover { text-decoration: underline; text-underline-offset: 2px; }
:focus-visible { outline: 2px solid var(--teal); outline-offset: 2px; border-radius: 5px; }

/* ---- header ---- */
.top { display: flex; align-items: flex-start; justify-content: space-between; gap: 18px; flex-wrap: wrap; }
.brand { display: flex; align-items: center; gap: 11px; }
.mark { width: 15px; height: 15px; border-radius: 4px; background: linear-gradient(150deg, var(--teal), #2aa89a);
  box-shadow: 0 0 0 1px rgba(61,216,196,0.35), 0 4px 14px rgba(61,216,196,0.28); flex: none; }
.wordmark { font-weight: 700; font-size: 20px; letter-spacing: -0.015em; }
.eyebrow { font-size: 12.5px; color: var(--muted); margin-top: 5px; max-width: 62ch; }
.live { display: inline-flex; align-items: center; gap: 8px; font-family: var(--mono); font-size: 11px;
  color: var(--muted); text-transform: uppercase; letter-spacing: 0.1em; border: 1px solid var(--line);
  border-radius: 999px; padding: 6px 12px; background: rgba(23,33,43,0.6); }
.live .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--teal); flex: none; }
.live[data-state="offline"] .dot { background: var(--rose); }

.contracts { display: flex; gap: 8px; flex-wrap: wrap; margin: 20px 0 26px; }
.cc { font-family: var(--mono); font-size: 11px; color: var(--muted); border: 1px solid var(--line);
  border-radius: 999px; padding: 6px 12px; background: rgba(23,33,43,0.5); }
.cc b { color: var(--text); font-weight: 500; text-transform: uppercase; letter-spacing: 0.06em; margin-right: 3px; }

.err { background: color-mix(in srgb, var(--rose) 12%, var(--panel)); border: 1px solid color-mix(in srgb, var(--rose) 40%, transparent);
  color: var(--text); border-radius: var(--radius-sm); padding: 13px 16px; margin-bottom: 22px; font-size: 14px; }

/* ---- metric row ---- */
.metrics { display: grid; grid-template-columns: repeat(4, 1fr); gap: 14px; margin-bottom: 30px; }
.metric { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius);
  padding: 18px 18px 16px; position: relative; overflow: hidden; }
.metric::before { content: ""; position: absolute; left: 18px; top: 0; width: 26px; height: 2px;
  background: var(--teal); border-radius: 0 0 2px 2px; opacity: 0.9; }
.metric .n { font-family: var(--mono); font-size: 30px; font-weight: 600; letter-spacing: -0.02em;
  line-height: 1.1; display: flex; align-items: baseline; gap: 6px; }
.metric .n .unit { font-size: 13px; color: var(--muted); font-weight: 500; letter-spacing: 0; }
.metric .l { font-size: 11px; color: var(--muted); margin-top: 8px; text-transform: uppercase; letter-spacing: 0.11em; font-weight: 600; }
.metric .sub { font-family: var(--mono); font-size: 11px; color: var(--faint); margin-top: 7px; }

/* ---- sections / cards ---- */
.section-head { display: flex; align-items: center; gap: 10px; margin: 30px 0 13px; }
.section-head h2 { font-size: 13px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--muted);
  font-weight: 600; margin: 0; }
.section-head .rule { flex: 1; height: 1px; background: var(--line-soft); }
.card { background: var(--panel); border: 1px solid var(--line); border-radius: var(--radius); overflow: hidden; }

.row { display: grid; gap: 14px; align-items: center; padding: 15px 18px; border-top: 1px solid var(--line-soft); }
.row:first-child { border-top: none; }
.agent-row { grid-template-columns: 1fr auto; }
.addr { font-family: var(--mono); font-size: 13.5px; }
.meta { font-size: 12px; color: var(--muted); margin-top: 4px; word-break: break-all; }
.rep { font-family: var(--mono); font-size: 11.5px; color: var(--teal); border: 1px solid color-mix(in srgb, var(--teal) 40%, transparent);
  border-radius: 999px; padding: 4px 10px; white-space: nowrap; background: rgba(61,216,196,0.06); }
.rep.zero { color: var(--muted); border-color: var(--line); background: none; }
.right { text-align: right; }
.right .meta { margin-top: 7px; }

/* attestation edges (inside the agents card) */
.edges-head { padding: 12px 18px; border-top: 1px solid var(--line); background: rgba(30,42,53,0.4);
  font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; color: var(--faint); font-weight: 600; }
.edge { display: grid; grid-template-columns: auto 1fr auto; align-items: center; gap: 12px; padding: 14px 18px; border-top: 1px solid var(--line-soft); }
.edge .node-addr { font-family: var(--mono); font-size: 13px; white-space: nowrap; }
.edge .flowwrap { display: flex; align-items: center; gap: 8px; min-width: 60px; }
.edge .flow { position: relative; height: 2px; background: var(--line); border-radius: 2px; flex: 1; overflow: hidden; }
.edge .tip { color: var(--teal); font-family: var(--mono); font-size: 14px; line-height: 1; }
.edge .edge-meta { font-family: var(--mono); font-size: 11px; color: var(--faint); white-space: nowrap; text-align: right; }

/* ---- escrow lifecycle ---- */
.escrow { padding: 16px 18px; border-top: 1px solid var(--line-soft); }
.escrow:first-child { border-top: none; }
.escrow-top { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
.escrow-id { font-family: var(--mono); font-size: 12px; color: var(--muted); border: 1px solid var(--line);
  border-radius: 6px; padding: 2px 8px; }
.escrow-parties { font-family: var(--mono); font-size: 13px; display: inline-flex; align-items: center; gap: 8px; }
.escrow-parties .tip { color: var(--teal); }
.escrow-amt { font-family: var(--mono); font-weight: 600; font-size: 14px; margin-left: auto; }
.escrow-amt .u { color: var(--muted); font-weight: 400; font-size: 12px; margin-left: 4px; }
.badge { font-family: var(--mono); font-size: 11px; text-transform: uppercase; letter-spacing: 0.06em;
  padding: 4px 11px; border-radius: 999px; border: 1px solid transparent; white-space: nowrap; }
.badge.open { color: var(--amber); border-color: color-mix(in srgb, var(--amber) 42%, transparent); background: rgba(224,162,78,0.07); }
.badge.released { color: var(--teal); border-color: color-mix(in srgb, var(--teal) 48%, transparent); background: rgba(61,216,196,0.08); }
.badge.refunded { color: var(--rose); border-color: color-mix(in srgb, var(--rose) 42%, transparent); background: rgba(242,103,140,0.07); }

.steps { display: flex; align-items: center; margin-top: 14px; }
.step { display: inline-flex; align-items: center; gap: 8px; }
.node { width: 11px; height: 11px; border-radius: 50%; border: 1.5px solid var(--line); background: var(--panel-2); flex: none; }
.node.done { background: var(--teal); border-color: var(--teal); box-shadow: 0 0 0 3px rgba(61,216,196,0.12); }
.node.pending { border-color: var(--amber); background: rgba(224,162,78,0.12); }
.node.refunded { background: var(--rose); border-color: var(--rose); box-shadow: 0 0 0 3px rgba(242,103,140,0.12); }
.step .slbl { font-size: 11px; text-transform: uppercase; letter-spacing: 0.09em; color: var(--faint); }
.step .slbl.on { color: var(--muted); }
.conn { width: 40px; height: 1.5px; background: var(--line); margin: 0 10px; }
.conn.done { background: var(--teal); }
.conn.refunded { background: var(--rose); }

.empty { padding: 30px 18px; color: var(--muted); font-size: 14px; text-align: center; }
.empty code { font-family: var(--mono); color: var(--text); background: var(--panel-2); border: 1px solid var(--line);
  border-radius: 6px; padding: 3px 8px; display: inline-block; margin-top: 10px; font-size: 12px; }
.foot { color: var(--faint); font-size: 12px; margin-top: 30px; border-top: 1px solid var(--line-soft); padding-top: 16px; }

/* skeleton (loading, before first fetch) */
.skel .n, .skel .sub { color: var(--faint); }

@media (max-width: 760px) {
  .metrics { grid-template-columns: repeat(2, 1fr); }
  .edge { grid-template-columns: 1fr; gap: 6px; }
  .edge .flowwrap { order: 3; }
  .edge .edge-meta { text-align: left; }
  .escrow-amt { margin-left: 0; }
}
@media (max-width: 440px) {
  .steps { flex-wrap: wrap; gap: 8px 0; }
  .conn { width: 22px; margin: 0 6px; }
  /* Hide the lifecycle labels visually but keep them in the accessibility tree —
     the .node indicators are colour-only, so the text is the only label for AT. */
  .step .slbl { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px;
    overflow: hidden; clip: rect(0 0 0 0); clip-path: inset(50%); white-space: nowrap; border: 0; }
}

/* =========================================================================
   MOTION — everything below is opt-in. Base styles above are the final,
   static, fully-visible state, so prefers-reduced-motion gets a calm page.
   ========================================================================= */
@media (prefers-reduced-motion: no-preference) {
  .reveal { opacity: 0; transform: translateY(10px); animation: rise 0.55s cubic-bezier(0.22, 1, 0.36, 1) forwards;
    animation-delay: calc(var(--i, 0) * 65ms); }
  @keyframes rise { to { opacity: 1; transform: none; } }

  .live .dot { animation: breathe 2.6s ease-in-out infinite; }
  @keyframes breathe {
    0%, 100% { transform: scale(1); box-shadow: 0 0 0 0 rgba(61,216,196,0.45); }
    50% { transform: scale(1.25); box-shadow: 0 0 0 5px rgba(61,216,196,0); }
  }

  .edge .flow::after { content: ""; position: absolute; top: 0; left: -45%; width: 45%; height: 100%;
    background: linear-gradient(90deg, transparent, var(--teal), transparent); animation: flow 1.9s linear infinite; }
  @keyframes flow { to { left: 115%; } }

  .badge.released { animation: softpulse 2.6s ease-in-out infinite; }
  @keyframes softpulse {
    0%, 100% { box-shadow: 0 0 0 0 rgba(61,216,196,0); }
    50% { box-shadow: 0 0 13px 1px rgba(61,216,196,0.4); }
  }
}
</style>
</head>
<body class="skel">
<div class="wrap">
  <header class="top">
    <div>
      <div class="brand"><span class="mark" aria-hidden="true"></span><span class="wordmark">agent-registry</span></div>
      <div class="eyebrow">Arc testnet · read-only · community project, not affiliated with, or endorsed by, Circle or Arc.</div>
    </div>
    <span class="live" id="live" data-state="loading"><span class="dot"></span><span id="live-text">loading</span></span>
  </header>

  <div class="contracts" id="contracts"></div>
  <div id="err"></div>

  <section class="metrics">
    <div class="metric reveal" style="--i:0"><div class="n"><span id="m-agents">—</span></div><div class="l">Agents</div></div>
    <div class="metric reveal" style="--i:1"><div class="n"><span id="m-attest">—</span></div><div class="l">Attestations</div></div>
    <div class="metric reveal" style="--i:2"><div class="n"><span id="m-escrow">—</span></div><div class="l">Escrows</div><div class="sub" id="m-escrow-sub">&nbsp;</div></div>
    <div class="metric reveal" style="--i:3"><div class="n"><span id="m-value">—</span><span class="unit">USDC</span></div><div class="l">Value released</div></div>
  </section>

  <div class="section-head"><h2>Registered agents</h2><span class="rule"></span></div>
  <div class="card reveal" style="--i:4" id="agents-card">
    <div id="agents"></div>
    <div id="edges"></div>
  </div>

  <div class="section-head"><h2>Escrow</h2><span class="rule"></span></div>
  <div class="card reveal" style="--i:5" id="escrows"></div>

  <p class="foot" id="foot">&nbsp;</p>
</div>

<script>
const REDUCE = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
const $ = (id) => document.getElementById(id);
const el = (t, c, txt) => { const n = document.createElement(t); if (c) n.className = c; if (txt != null) n.textContent = txt; return n; };
let EXPLORER = "https://testnet.arcscan.app";
const link = (addr, cls) => { const a = el("a", cls || "addr", addr); a.href = EXPLORER + "/address/" + addr; a.target = "_blank"; a.rel = "noreferrer"; return a; };
const timeAgo = (s) => { if (!s) return ""; const d = Date.now()/1000 - s; if (d < 90) return "just now"; if (d < 3600) return Math.floor(d/60)+"m ago"; if (d < 86400) return Math.floor(d/3600)+"h ago"; return Math.floor(d/86400)+"d ago"; };
const fmtNum = (n) => new Intl.NumberFormat("en-US", { maximumFractionDigits: 6 }).format(n);

// Count-up that persists its last value on the node, so the 15s poll doesn't
// re-animate unchanged metrics. Jumps straight to the target under reduced motion.
function countTo(node, to, opts) {
  opts = opts || {};
  const fmt = opts.decimals ? (v) => fmtNum(v) : (v) => String(Math.round(v));
  const from = Number(node.dataset.val || 0);
  if (REDUCE || from === to) { node.textContent = fmt(to); node.dataset.val = to; return; }
  const dur = 900; let start = null;
  function frame(t) {
    if (start === null) start = t;                       // anchor to rAF's own clock
    const p = Math.min(1, Math.max(0, (t - start) / dur)); // clamp — never overshoot
    const e = 1 - Math.pow(1 - p, 3);
    node.textContent = fmt(from + (to - from) * e);
    if (p < 1) requestAnimationFrame(frame);
    else { node.textContent = fmt(to); node.dataset.val = to; }
  }
  requestAnimationFrame(frame);
}

function emptyCard(box, msg, cmd) {
  const e = el("div", "empty");
  e.append(el("div", null, msg));
  if (cmd) { const code = el("code"); code.textContent = cmd; e.append(code); }
  box.append(e);
}

function render(m) {
  EXPLORER = m.explorer || EXPLORER;
  document.body.classList.remove("skel");
  $("live").dataset.state = "live";
  $("live-text").textContent = "live";

  // contract chips
  const cc = $("contracts"); cc.replaceChildren();
  for (const [k, v] of Object.entries(m.contracts)) {
    const chip = el("span", "cc"); chip.append(el("b", null, k), link(v)); cc.append(chip);
  }

  // error banner
  $("err").replaceChildren();
  if (m.error) $("err").append(el("div", "err", m.error));

  // metrics (count-up)
  const escrowTotal = m.stats.open + m.stats.released + m.stats.refunded;
  const valueReleased = m.escrows.filter((e) => e.status === "released").reduce((s, e) => s + Number(e.amount), 0);
  countTo($("m-agents"), m.stats.agents);
  countTo($("m-attest"), m.stats.attestations);
  countTo($("m-escrow"), escrowTotal);
  countTo($("m-value"), valueReleased, { decimals: true });
  $("m-escrow-sub").textContent = m.stats.open + " open · " + m.stats.released + " released · " + m.stats.refunded + " refunded";

  // agents
  const ag = $("agents"); ag.replaceChildren();
  if (!m.agents.length) emptyCard(ag, "No agents registered yet.", "cast send $REGISTRY 'registerAgent(string)' ipfs://you");
  else for (const a of m.agents) {
    const row = el("div", "row agent-row");
    const l = el("div"); l.append(link(a.address)); l.append(el("div", "meta", a.metadataURI));
    const r = el("div", "right");
    r.append(el("span", "rep" + (a.reputation ? "" : " zero"), a.reputation + (a.reputation === 1 ? " attestation" : " attestations")));
    r.append(el("div", "meta", "registered " + timeAgo(a.registeredAt)));
    row.append(l, r); ag.append(row);
  }

  // attestation edges (A -> B), inside the same card
  const ed = $("edges"); ed.replaceChildren();
  if (m.agents.length) {
    ed.append(el("div", "edges-head", "Attestation edges"));
    if (!m.attestations.length) {
      const e = el("div", "empty"); e.style.padding = "22px 18px";
      e.append(el("div", null, "No attestations yet — a registered agent can vouch for another."));
      ed.append(e);
    } else for (const x of m.attestations) {
      const row = el("div", "edge");
      row.append(link(x.attesterShort, "node-addr"));
      const fw = el("div", "flowwrap"); fw.append(el("div", "flow"), el("span", "tip", "→")); row.append(fw);
      // wrap subject + meta on the right
      const right = el("div"); right.style.display = "flex"; right.style.flexDirection = "column"; right.style.alignItems = "flex-end"; right.style.gap = "3px";
      right.append(link(x.subjectShort, "node-addr"), el("div", "edge-meta", "data " + x.data.slice(0, 10) + "… · " + timeAgo(x.at)));
      row.append(right);
      ed.append(row);
    }
  }

  // escrows — lifecycle: created -> funded -> released/refunded
  const es = $("escrows"); es.replaceChildren();
  if (!m.escrows.length) emptyCard(es, "No escrows yet. A payer can deposit USDC for a registered agent.", "cast send $ESCROW 'createEscrow(address,uint256,uint64)' $PAYEE 1000000 $DEADLINE");
  else for (const e of m.escrows) {
    const box = el("div", "escrow");
    const top = el("div", "escrow-top");
    top.append(el("span", "escrow-id", "#" + e.id));
    const parties = el("span", "escrow-parties"); parties.append(link(e.payerShort), el("span", "tip", "→"), link(e.payeeShort));
    top.append(parties);
    const amt = el("span", "escrow-amt"); amt.append(document.createTextNode(fmtNum(Number(e.amount))), el("span", "u", "USDC"));
    top.append(amt);
    top.append(el("span", "badge " + e.status, e.status));
    box.append(top);

    // 3-step lifecycle. created + funded always done (funds lock on create); 3rd is terminal state.
    const terminal = e.status === "released" ? { node: "done", conn: "done", label: "Released" }
      : e.status === "refunded" ? { node: "refunded", conn: "refunded", label: "Refunded" }
      : { node: "pending", conn: "", label: "Pending" };
    const steps = el("div", "steps");
    const step = (nodeCls, label, on) => { const s = el("div", "step"); s.append(el("span", "node " + nodeCls), el("span", "slbl" + (on ? " on" : ""), label)); return s; };
    const conn = (cls) => el("div", "conn" + (cls ? " " + cls : ""));
    steps.append(step("done", "Created", true), conn("done"), step("done", "Funded", true), conn(terminal.conn), step(terminal.node, terminal.label, terminal.node !== "pending"));
    box.append(steps);
    es.append(box);
  }

  $("foot").textContent = "Read directly from the three verified contracts on Arc testnet — no wallet, no writes. Updated " + timeAgo(m.generatedAt || Math.floor(Date.now()/1000)) + ".";
}

async function boot() {
  // Load path — only a fetch/parse failure means the server is unreachable.
  let state;
  try {
    const res = await fetch("/api/state");
    state = await res.json();
  } catch (e) {
    document.body.classList.remove("skel");
    $("live").dataset.state = "offline"; $("live-text").textContent = "offline";
    $("err").replaceChildren(el("div", "err", "Couldn't reach the dashboard server. Retrying…"));
    return;
  }
  // Render path — a failure here is a display bug, not an outage; don't flip to offline.
  try {
    render(state);
  } catch (e) {
    document.body.classList.remove("skel");
    $("err").replaceChildren(el("div", "err", "Something went wrong displaying the latest data."));
  }
}
boot();
setInterval(boot, 15000);
</script>
</body>
</html>`;
}
