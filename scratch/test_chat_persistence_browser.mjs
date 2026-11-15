import WebSocket from 'ws';
import http from 'http';
import fs from 'fs';

async function run() {
  const tabs = await new Promise((res, rej) => {
    http.get('http://127.0.0.1:9222/json/list', r => {
      let d = '';
      r.on('data', c => d += c);
      r.on('end', () => res(JSON.parse(d)));
    }).on('error', rej);
  });

  const cortexTab = tabs.find(t => t.url && t.url.includes('/cortex'));
  if (!cortexTab) {
    console.error('No cortex tab found');
    process.exit(1);
  }

  const ws = new WebSocket(cortexTab.webSocketDebuggerUrl);
  let id = 1;
  const pending = new Map();

  function call(method, params = {}) {
    return new Promise((res, rej) => {
      const msgId = id++;
      pending.set(msgId, { res, rej });
      ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  ws.on('message', data => {
    const msg = JSON.parse(data);
    if (msg.id && pending.has(msg.id)) {
      const { res, rej } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) rej(msg.error);
      else res(msg.result);
    }
  });

  await new Promise(r => ws.on('open', r));
  console.log('Connected to CDP');

  // Step 1: Reload tab cleanly to test fresh hydration
  console.log('Reloading tab...');
  await call('Page.reload', {});
  await new Promise(r => setTimeout(r, 2500));

  // Step 2: Inject initial user message
  const prompt1 = 'Let us work on finding the Salvation Army financial assistance application for Atlanta.';
  console.log(`Injecting user message 1: "${prompt1}"`);

  await call('Runtime.evaluate', {
    expression: `
      (function() {
        const input = document.getElementById('cortex-chat-input');
        if (input) {
          input.value = ${JSON.stringify(prompt1)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
          const form = input.closest('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          } else {
            const sendBtn = document.getElementById('cortex-send-btn');
            if (sendBtn) sendBtn.click();
          }
        }
      })()
    `
  });

  // Step 3: Wait for Cortex to complete turn 1
  console.log('Waiting for Cortex response to complete...');
  let completed = false;
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const rawRes = await call('Runtime.evaluate', {
      expression: `
        (function() {
          const isSending = !!document.getElementById('cortex-stop-btn');
          const saved = localStorage.getItem('cortex_chat_history_v1');
          return { isSending, savedLength: saved ? JSON.parse(saved).length : 0 };
        })()
      `,
      returnByValue: true
    });
    const val = rawRes?.result?.value || rawRes?.value || {};
    console.log(`Polling status [${i}]: isSending=${val.isSending}, savedMsgs=${val.savedLength}`);
    if (!val.isSending && val.savedLength >= 2 && i > 3) {
      completed = true;
      break;
    }
  }

  // Step 4: Verify localStorage has saved messages
  const storageCheck1 = await call('Runtime.evaluate', {
    expression: `localStorage.getItem('cortex_chat_history_v1')`,
    returnByValue: true
  });
  const storedJson = storageCheck1?.result?.value || storageCheck1?.value;
  console.log('LocalStorage chat history length:', storedJson ? JSON.parse(storedJson).length : 0);

  // Step 5: RELOAD THE PAGE (Simulate browser reload / restart / crash recovery)
  console.log('\n--- SIMULATING BROWSER REOPEN / RELOAD ---');
  await call('Page.reload', {});
  await new Promise(r => setTimeout(r, 3000));

  // Step 6: Verify messages re-hydrated into DOM
  const domCheckAfterReload = await call('Runtime.evaluate', {
    expression: `
      (function() {
        const saved = localStorage.getItem('cortex_chat_history_v1');
        const text = document.body.innerText;
        return {
          rehydratedCount: saved ? JSON.parse(saved).length : 0,
          domHasSalvationArmy: text.includes('Salvation Army') || text.includes('salvation'),
          domSnippet: text.slice(0, 300)
        };
      })()
    `,
    returnByValue: true
  });
  const rehydrated = domCheckAfterReload?.result?.value || domCheckAfterReload?.value;
  console.log('DOM check after reload:', JSON.stringify(rehydrated, null, 2));

  // Step 7: Send user recall query
  const prompt2 = 'are you able to re-listen or go back to a previous chat that we just had and spin up what we were talking about';
  console.log(`\nInjecting recall query 2: "${prompt2}"`);

  await call('Runtime.evaluate', {
    expression: `
      (function() {
        const input = document.getElementById('cortex-chat-input');
        if (input) {
          input.value = ${JSON.stringify(prompt2)};
          input.dispatchEvent(new Event('input', { bubbles: true }));
          const form = input.closest('form');
          if (form) {
            form.dispatchEvent(new Event('submit', { cancelable: true, bubbles: true }));
          } else {
            const sendBtn = document.getElementById('cortex-send-btn');
            if (sendBtn) sendBtn.click();
          }
        }
      })()
    `
  });

  // Step 8: Wait for Cortex recall response
  console.log('Waiting for Cortex recall response...');
  for (let i = 0; i < 40; i++) {
    await new Promise(r => setTimeout(r, 1000));
    const rawRes = await call('Runtime.evaluate', {
      expression: `
        (function() {
          const isSending = !!document.getElementById('cortex-stop-btn');
          const text = document.body.innerText;
          return { isSending, text: text.slice(-1500) };
        })()
      `,
      returnByValue: true
    });
    const val = rawRes?.result?.value || rawRes?.value || {};
    if (!val.isSending && i > 3) {
      console.log('\n--- Turn 2 Recall Response Received ---');
      console.log(val.text);
      break;
    }
  }

  // Step 9: Capture full screenshot
  const shot = await call('Page.captureScreenshot', { format: 'png' });
  const shotPath = '/Users/Apple/.gemini/antigravity/brain/b36a1d58-0019-4d2d-86d7-cb42d4c5ed1b/cortex_chat_history_recall_proof.png';
  fs.writeFileSync(shotPath, Buffer.from(shot.data, 'base64'));
  console.log('\nSaved screenshot to:', shotPath);

  ws.close();
  process.exit(0);
}

run().catch(e => {
  console.error(e);
  process.exit(1);
});
