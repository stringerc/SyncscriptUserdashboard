/**
 * Hermes Mock Server — local fallback executor for tests and tunnels.
 * Listens on HERMES_MOCK_PORT or 18880.
 */
import http from 'node:http';

const PORT = parseInt(process.env.HERMES_MOCK_PORT || process.env.HERMES_EXECUTOR_PORT || '18880', 10);
const seenKeys = new Set();

const server = http.createServer((req, res) => {
  const url = req.url || '/';

  if (req.method === 'GET' && (url === '/health' || url === '/healthz' || url === '/')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, status: 'healthy', timestamp: Date.now() }));
    return;
  }

  if (req.method === 'GET' && (url === '/v1/tools' || url === '/tools')) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({
      tools: [
        { name: 'create_calendar_hold', description: 'Create hold on primary calendar' },
        { name: 'apply_task_patch', description: 'Patch task state' }
      ]
    }));
    return;
  }

  if (req.method === 'POST' && (url === '/v1/invoke' || url === '/v1/invoke/' || url === '/invoke')) {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let parsed = {};
      try { parsed = JSON.parse(body || '{}'); } catch {}

      const idemKey = parsed.idempotency_key;
      const isDeduped = Boolean(idemKey && seenKeys.has(idemKey));
      if (idemKey) seenKeys.add(idemKey);

      const run_id = `hermes-run-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      const trace = [
        { step: 'parse', status: 'ok', at: new Date().toISOString() },
        ...(isDeduped ? [{ step: 'idempotency', status: 'ok', detail: 'duplicate key found', at: new Date().toISOString() }] : []),
        { step: 'execute', status: 'ok', detail: `Tool ${parsed.tool || 'generic'} executed`, at: new Date().toISOString() }
      ];

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ok: true,
        tool: parsed.tool,
        run_id,
        result: { executed: true },
        trace,
        deduped: isDeduped ? true : undefined
      }));
    });
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, '127.0.0.1', () => {
  console.log(`[hermes-mock-server] Listening on http://127.0.0.1:${PORT}`);
});

