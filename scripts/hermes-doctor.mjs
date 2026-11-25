#!/usr/bin/env node
/**
 * hermes doctor — layered diagnostic for the sovereign tool host.
 * Exercises every hop a real invoke takes and every tool class, then
 * reports PASS/FAIL/WARN per check. Exit 1 on any FAIL.
 *
 * Layers: edge-bridge → tunnel → executor → policy → journal.
 * Env: HERMES_SERVICE_TOKEN (required for service-path checks),
 *      HERMES_DOCTOR_INVOKE=0 to skip live invokes (health-only).
 */
const EDGE_BASE = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://kwhnrlzibgfedtxpkbgb.supabase.co').replace(/\/$/, '');
const BRIDGE = `${EDGE_BASE}/functions/v1/make-server-57781ad9/hermes`;
const ANON = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SVC = process.env.HERMES_SERVICE_TOKEN || '';
const DIRECT = process.env.HERMES_EXECUTOR_URL || process.env.HERMES_BASE_URL_TARGET || 'http://127.0.0.1:18880';
const SKIP_INVOKE = process.env.HERMES_DOCTOR_INVOKE === '0';

const results = [];
const check = (name, status, detail = '') => {
  results.push({ name, status, detail });
  console.log(`  ${status === 'PASS' ? 'PASS' : status === 'WARN' ? 'WARN' : 'FAIL'}  ${name}${detail ? ` — ${detail}` : ''}`);
};
const j = async (r) => { try { return await r.json(); } catch { return {}; } };

async function probe(url, headers, timeoutMs = 10000) {
  const t0 = Date.now();
  try {
    const r = await fetch(url, { headers, signal: AbortSignal.timeout(timeoutMs) });
    return { ok: r.ok, status: r.status, ms: Date.now() - t0, body: await j(r) };
  } catch (e) {
    return { ok: false, status: 0, ms: Date.now() - t0, error: String(e?.message || e) };
  }
}

console.log('\n== hermes doctor ==\n');

// 1. Edge bridge health (production path probe)
{
  const r = await probe(`${BRIDGE}/health`, { Accept: 'application/json', ...(ANON ? { apikey: ANON, Authorization: `Bearer ${ANON}` } : {}) });
  const st = r.body?.hermesStatus;
  check('edge bridge reachable', r.ok ? 'PASS' : 'FAIL', `http ${r.status} ${r.ms}ms`);
  check('executor connected via edge', st === 'connected' ? 'PASS' : 'FAIL', `hermesStatus=${st || 'none'}`);
}

// 2. Local executor (dev path — WARN only, production is edge)
{
  const r = await probe(`${DIRECT}/health`, { Accept: 'application/json' }, 3000);
  const v = r.body?.version;
  check('executor health (direct)', r.ok ? 'PASS' : 'WARN', r.ok ? `v${v} @ ${DIRECT}` : `${DIRECT} unreachable (edge path is authoritative)`);
}

// 3. Service auth on bridge
if (SVC) {
  const r = await probe(`${BRIDGE}/tools`, { Accept: 'application/json', apikey: ANON, Authorization: `Bearer ${SVC}` });
  const n = Array.isArray(r.body?.tools) ? r.body.tools.length : 0;
  check('service token accepted by bridge', r.ok && n > 0 ? 'PASS' : 'FAIL', `http ${r.status}, ${n} tools`);

  // 4. Tool registry completeness — v2 markers
  const names = (r.body?.tools || []).map((t) => t?.name || t);
  const required = ['fs_read', 'fs_write', 'fs_patch', 'shell_exec', 'http_request', 'git_op', 'rollback'];
  const missing = required.filter((x) => !names.includes(x));
  check('v2 tool registry', missing.length === 0 ? 'PASS' : 'FAIL', missing.length ? `missing: ${missing.join(',')}` : `${names.length} tools`);

  // 5. Policy: service caller must be refused user-scoped tool
  if (!SKIP_INVOKE) {
    const res = await fetch(`${BRIDGE}/invoke`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${SVC}` },
      body: JSON.stringify({ tool: 'apply_task_patch', arguments: { task_id: 'doctor-probe', patch: {}, dry_run: true } }),
      signal: AbortSignal.timeout(20000),
    });
    const body = await j(res);
    const denied = res.status === 400 && /signed-in user/i.test(String(body?.error || ''));
    check('service caller denied user-scoped tool', denied ? 'PASS' : 'FAIL', `http ${res.status} ${String(body?.error || '').slice(0, 80)}`);

    // 6. Read-class invoke round-trip (list_tools — no side effects)
    const res2 = await fetch(`${BRIDGE}/invoke`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${SVC}` },
      body: JSON.stringify({ tool: 'list_tools', arguments: {} }),
      signal: AbortSignal.timeout(20000),
    });
    const body2 = await j(res2);
    check('invoke round-trip (list_tools)', res2.ok && body2?.ok === true ? 'PASS' : 'FAIL', `http ${res2.status} run=${body2?.run_id || 'none'}`);

    // 7. Dry-run fs_write — exercises policy+snapshot path without mutation
    const res3 = await fetch(`${BRIDGE}/invoke`, {
      method: 'POST',
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', apikey: ANON, Authorization: `Bearer ${SVC}` },
      body: JSON.stringify({ tool: 'fs_write', arguments: { path: 'integrations/.doctor-dryrun.tmp', content: 'x', dry_run: true } }),
      signal: AbortSignal.timeout(20000),
    });
    const body3 = await j(res3);
    check('dry-run fs_write', res3.ok && body3?.ok === true && body3?.dry_run ? 'PASS' : 'FAIL', `http ${res3.status}`);

    // 8. Journal query — the run from check 6 must be recorded
    const res4 = await fetch(`${BRIDGE}/runs?limit=5`, {
      headers: { Accept: 'application/json', apikey: ANON, Authorization: `Bearer ${SVC}` },
      signal: AbortSignal.timeout(15000),
    });
    const body4 = await j(res4);
    const found = (body4?.runs || []).some((r) => r?.run_id === body2?.run_id);
    check('journal records invokes', res4.ok && found ? 'PASS' : 'WARN', `http ${res4.status}, run ${found ? 'found' : 'not in tail'}`);
  } else {
    check('live invokes', 'WARN', 'HERMES_DOCTOR_INVOKE=0 — skipped');
  }
} else {
  check('service token', 'WARN', 'HERMES_SERVICE_TOKEN unset — service-path checks skipped');
}

const fails = results.filter((r) => r.status === 'FAIL').length;
const warns = results.filter((r) => r.status === 'WARN').length;
console.log(`\n== ${fails === 0 ? 'ALL GREEN' : `${fails} FAILURES`} (${warns} warnings) ==\n`);
process.exit(fails === 0 ? 0 : 1);
