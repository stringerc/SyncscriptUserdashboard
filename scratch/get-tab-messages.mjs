import { WebSocket } from 'ws';
import http from 'node:http';

http.get('http://127.0.0.1:9222/json', (res) => {
  let data = '';
  res.on('data', c => data += c);
  res.on('end', async () => {
    const tabs = JSON.parse(data);
    const tab = tabs.find(t => t.url && t.url.includes('5173'));
    const ws = new WebSocket(tab.webSocketDebuggerUrl);
    ws.on('open', () => {
      ws.send(JSON.stringify({
        id: 1,
        method: 'Runtime.evaluate',
        params: {
          expression: `
            (() => {
              const divs = Array.from(document.querySelectorAll('div'));
              const items = [];
              for (const d of divs) {
                const text = d.innerText || '';
                if (text.startsWith('You\\n') || text.startsWith('CORTEX\\n')) {
                  items.push({ text: text.slice(0, 300) });
                }
              }
              return items.slice(-8);
            })()
          `,
          returnByValue: true
        }
      }));
    });
    ws.on('message', m => {
      const p = JSON.parse(m.toString());
      console.log('Result:', JSON.stringify(p.result?.result?.value, null, 2));
      ws.close();
      process.exit(0);
    });
  });
});

