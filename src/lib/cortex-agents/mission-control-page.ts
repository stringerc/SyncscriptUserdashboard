/**
 * Mission Control — self-contained fleet dashboard (fleet spec §7).
 * Served at /api/cortex/mission-control; polls the aggregate telemetry
 * endpoint every 5s. No build step, no deps — one HTML document.
 */

export const MISSION_CONTROL_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Cortex Mission Control</title>
<style>
  :root { --bg:#0a0e14; --panel:#11161f; --line:#1f2937; --txt:#c9d1d9; --dim:#6b7280; --grn:#34d399; --amb:#fbbf24; --red:#f87171; --blu:#60a5fa; --pur:#a78bfa; }
  * { box-sizing:border-box; margin:0; }
  body { background:var(--bg); color:var(--txt); font:13px/1.5 ui-monospace,SFMono-Regular,Menlo,monospace; padding:20px; }
  h1 { font-size:15px; letter-spacing:.15em; color:var(--blu); margin-bottom:4px; }
  .sub { color:var(--dim); margin-bottom:18px; font-size:11px; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(210px,1fr)); gap:10px; margin-bottom:18px; }
  .card { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:10px 12px; }
  .card h3 { font-size:10px; text-transform:uppercase; letter-spacing:.1em; color:var(--dim); margin-bottom:6px; }
  .card .big { font-size:20px; font-weight:600; }
  .agents { display:grid; grid-template-columns:repeat(auto-fill,minmax(150px,1fr)); gap:8px; margin-bottom:18px; }
  .agent { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:8px 10px; cursor:pointer; }
  .agent.sel { border-color:var(--blu); }
  .agent .nm { font-weight:600; font-size:12px; }
  .agent .rl { color:var(--dim); font-size:10px; }
  .dot { display:inline-block; width:8px; height:8px; border-radius:50%; margin-right:6px; }
  .st-idle{background:var(--grn)} .st-working{background:var(--blu);animation:p 1s infinite alternate} .st-error{background:var(--red)} .st-offline,.st-retired{background:var(--dim)}
  @keyframes p{to{opacity:.4}}
  table { width:100%; border-collapse:collapse; font-size:11px; }
  th { text-align:left; color:var(--dim); font-weight:400; padding:4px 8px; border-bottom:1px solid var(--line); }
  td { padding:4px 8px; border-bottom:1px solid #161c26; }
  .cols { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
  @media(max-width:900px){.cols{grid-template-columns:1fr}}
  .section { margin-bottom:18px; }
  .empty { color:var(--dim); font-style:italic; padding:6px 0; }
  .tag { display:inline-block; padding:1px 6px; border-radius:4px; font-size:10px; border:1px solid var(--line); margin-right:4px; }
  .tag.approved{color:var(--grn);border-color:var(--grn)} .tag.contested,.tag.escalated,.tag.expired{color:var(--amb);border-color:var(--amb)} .tag.open{color:var(--blu);border-color:var(--blu)}
  #detail { background:var(--panel); border:1px solid var(--line); border-radius:8px; padding:12px; margin-top:14px; display:none; white-space:pre-wrap; font-size:11px; max-height:340px; overflow:auto; }
  .err { color:var(--red); }
</style>
</head>
<body>
<h1>◈ CORTEX MISSION CONTROL</h1>
<div class="sub" id="ts">connecting…</div>
<div class="grid" id="stats"></div>
<div class="section"><h3 style="color:var(--dim);font-size:10px;letter-spacing:.1em;margin-bottom:8px">AGENTS</h3><div class="agents" id="agents"></div></div>
<div class="cols">
  <div class="section"><h3 style="color:var(--dim);font-size:10px;letter-spacing:.1em;margin-bottom:8px">VERIFICATIONS</h3><div id="verifs"></div></div>
  <div class="section"><h3 style="color:var(--dim);font-size:10px;letter-spacing:.1em;margin-bottom:8px">PATROLS &amp; SKILLS</h3><div id="patrols"></div><div id="skills"></div></div>
</div>
<div id="detail"></div>
<script>
const $ = (id) => document.getElementById(id);
let selected = null;
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
async function tick() {
  try {
    const d = await (await fetch('/api/cortex/agents/mission-control')).json();
    if (!d.ok) throw new Error(d.error || 'bad payload');
    $('ts').textContent = 'last update ' + new Date(d.at).toLocaleTimeString() + ' · poll 5s';
    const cards = [
      ['Agents', d.agents.length, ''],
      ['Working', d.tasks.running, 'var(--blu)'],
      ['Queued', d.tasks.queued, 'var(--amb)'],
      ['Mesh msgs', d.mesh.total, ''],
      ['Unacked acks', d.mesh.unackedRequiresAck, d.mesh.unackedRequiresAck ? 'var(--red)' : ''],
      ['DLQ', d.mesh.deadLetters, d.mesh.deadLetters ? 'var(--amb)' : ''],
      ['Workspace keys', d.workspace.live, ''],
      ['Namespaces', Object.keys(d.workspace.byNamespace || {}).length, ''],
      ['Skills', d.skills.total, ''],
      ['Verifications', d.verifications.total, ''],
      ['Verif open', d.verifications.open, d.verifications.open ? 'var(--blu)' : ''],
      ['Pending heals', d.patrols.pendingHeals, d.patrols.pendingHeals ? 'var(--amb)' : ''],
    ];
    $('stats').innerHTML = cards.map(c =>
      '<div class="card"><h3>'+esc(c[0])+'</h3><div class="big" style="color:'+(c[2]||'var(--txt)')+'">'+esc(c[1])+'</div></div>').join('');
    $('agents').innerHTML = (d.agents || []).map(a => {
      const w = (d.window24h || {})[a.id];
      const w24 = w ? ' · 24h ' + w.completed + '✓/' + w.failed + '✗' + (w.failed ? ' (' + Object.entries(w.byClass).map(([k,v])=>k+':'+v).join(',') + ')' : '') : '';
      return '<div class="agent'+(selected===a.id?' sel':'')+'" data-id="'+esc(a.id)+'">'+
      '<div class="nm"><span class="dot st-'+esc(a.status)+'"></span>'+esc(a.name || a.id)+'</div>'+
      '<div class="rl">'+esc(a.status)+' · ✓'+a.tasksCompleted+' ✗'+a.tasksFailed+w24+(a.currentTaskId?' · working':'')+'</div></div>';
    }).join('');
    document.querySelectorAll('.agent').forEach(el => el.onclick = () => {
      selected = el.dataset.id;
      const a = d.agents.find(x => x.id === selected);
      $('detail').style.display = 'block';
      $('detail').textContent = JSON.stringify(a, null, 2);
      document.querySelectorAll('.agent').forEach(x => x.classList.toggle('sel', x.dataset.id === selected));
    });
    const vs = (window.__verifs ||= []);
    // verifications list comes from a second fetch (not in aggregate) — try it
    try {
      const vd = await (await fetch('/api/cortex/agents/verifications?limit=20')).json();
      const list = vd.verifications || [];
      $('verifs').innerHTML = list.length ? '<table><tr><th>id</th><th>subject</th><th>status</th><th>votes</th></tr>' +
        list.slice().reverse().map(v => '<tr><td>'+esc(v.id)+'</td><td>'+esc(v.subject).slice(0,60)+'</td>'+
        '<td><span class="tag '+esc(v.status)+'">'+esc(v.status)+'</span></td><td>'+(v.votes||[]).map(x=>esc(x.verifierId)+':'+esc(x.verdict)).join(', ')+'</td></tr>').join('') + '</table>'
        : '<div class="empty">no verifications yet</div>';
    } catch { $('verifs').innerHTML = '<div class="empty err">verifications feed unavailable</div>'; }
    $('patrols').innerHTML =
      '<div style="margin-bottom:8px;color:var(--dim);font-size:11px">pending heal-gates: '+d.patrols.pendingHeals+
      ' · last heal dispatch: '+(d.patrols.lastHealDispatchAt ? new Date(d.patrols.lastHealDispatchAt).toLocaleString() : 'never')+'</div>' +
      ((d.patrols.recentFindings||[]).length ? '<table><tr><th>patrol</th><th>verification</th><th>at</th></tr>' +
        d.patrols.recentFindings.slice().reverse().map(f => '<tr><td>'+esc(f.patrolId)+'</td><td>'+esc(f.verificationId)+'</td><td>'+new Date(f.at).toLocaleTimeString()+'</td></tr>').join('') + '</table>'
        : '<div class="empty">no findings yet</div>');
    try {
      const sd = await (await fetch('/api/cortex/agents/skills')).json();
      const sl = sd.skills || [];
      $('skills').innerHTML = sl.length ? '<table><tr><th>skill</th><th>ver</th><th>trust</th><th>capabilities</th></tr>' +
        sl.map(s => '<tr><td>'+esc(s.name)+'</td><td>'+esc(s.version)+'</td><td>'+(s.trustScore*100).toFixed(0)+'%</td><td>'+esc((s.capabilities||[]).join(', ')).slice(0,50)+'</td></tr>').join('') + '</table>'
        : '<div class="empty">marketplace empty — register via POST /api/cortex/agents/skills</div>';
    } catch { $('skills').innerHTML = '<div class="empty err">skills feed unavailable</div>'; }
  } catch (e) {
    $('ts').innerHTML = '<span class="err">feed error: ' + esc(e.message) + '</span>';
  }
}
tick(); setInterval(tick, 5000);
</script>
</body>
</html>`;
