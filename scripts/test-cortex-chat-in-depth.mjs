import { WebSocket } from 'ws';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';

const ARTIFACTS_DIR = '/Users/Apple/.gemini/antigravity-ide/brain/b36a1d58-0019-4d2d-86d7-cb42d4c5ed1b';

function getCortexTab() {
  return new Promise((resolve, reject) => {
    http.get('http://127.0.0.1:9222/json', (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        try {
          const list = JSON.parse(data);
          const tab = list.find(t => t.url && t.url.includes('/cortex'));
          if (!tab) return reject(new Error('No Cortex tab found in Chrome at 9222'));
          resolve(tab);
        } catch (e) {
          reject(e);
        }
      });
    }).on('error', reject);
  });
}

class CDPClient {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.nextId = 1;
    this.pending = new Map();
  }

  async connect() {
    return new Promise((resolve, reject) => {
      this.ws = new WebSocket(this.wsUrl);
      this.ws.on('open', resolve);
      this.ws.on('error', reject);
      this.ws.on('message', (msg) => {
        try {
          const parsed = JSON.parse(msg.toString());
          if (parsed.id && this.pending.has(parsed.id)) {
            const { resolve, reject } = this.pending.get(parsed.id);
            this.pending.delete(parsed.id);
            if (parsed.error) reject(new Error(parsed.error.message || JSON.stringify(parsed.error)));
            else resolve(parsed.result);
          }
        } catch (e) {
          console.error('[CDP error parsing]', e);
        }
      });
    });
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const id = this.nextId++;
      this.pending.set(id, { resolve, reject });
      this.ws.send(JSON.stringify({ id, method, params }));
    });
  }

  async eval(expression) {
    const res = await this.send('Runtime.evaluate', {
      expression,
      returnByValue: true,
      awaitPromise: true,
    });
    if (res?.exceptionDetails) {
      throw new Error(`Eval exception: ${JSON.stringify(res.exceptionDetails)}`);
    }
    return res?.result?.value;
  }

  async captureScreenshot(filename) {
    const res = await this.send('Page.captureScreenshot', { format: 'png' });
    const buffer = Buffer.from(res.data, 'base64');
    const outPath = path.join(ARTIFACTS_DIR, filename);
    fs.writeFileSync(outPath, buffer);
    console.log(`[Screenshot saved] ${outPath} (${(buffer.length / 1024).toFixed(1)} KB)`);
    return outPath;
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

async function getMessages(cdp) {
  return await cdp.eval(`(() => {
    if (typeof window.__cortexMessages === 'function') {
      return window.__cortexMessages().map(m => ({ role: m.role, content: m.content, meta: m.meta }));
    }
    return [];
  })()`);
}

async function main() {
  console.log('=== Cortex Live In-Depth Chat Verification ===\n');

  const tab = await getCortexTab();
  console.log(`Target: ${tab.title} (${tab.id})`);
  const cdp = new CDPClient(tab.webSocketDebuggerUrl);
  await cdp.connect();

  await cdp.send('Page.enable');
  await cdp.send('Runtime.enable');

  // Reload page to ensure latest bundle and clean chat state
  console.log('1. Reloading Cortex page to sync fresh runtime state...');
  await cdp.send('Page.reload');
  await sleep(3000);

  // Wait for React hydration
  console.log('2. Waiting for Cortex chat hooks...');
  let ready = false;
  for (let i = 0; i < 30; i++) {
    const hasSend = await cdp.eval('typeof window.__cortexSend === "function"');
    if (hasSend) {
      ready = true;
      break;
    }
    await sleep(500);
  }

  if (!ready) {
    throw new Error('Cortex failed to initialize window.__cortexSend');
  }
  console.log('✓ Cortex chat ready.');

  const testResults = [];

  // ── TEST 1: Direct Conversational Chat ──────────────────────────
  console.log('\n--- Test 1: Direct Conversational Chat ("testing to see if this works") ---');
  await cdp.eval('window.__cortexSend("testing to see if this works")');
  
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const isSending = await cdp.eval('typeof window.__cortexIsSending === "function" ? window.__cortexIsSending() : false');
    if (!isSending) break;
  }

  const messagesT1 = await getMessages(cdp);
  const lastAiT1 = [...messagesT1].reverse().find(m => m.role === 'ai');
  console.log('T1 Last AI Response:', lastAiT1?.content?.slice(0, 140));

  const t1Passed = Boolean(
    lastAiT1 &&
    !lastAiT1.content.includes('API 503') &&
    !lastAiT1.content.includes('hiccup') &&
    (lastAiT1.content.includes('Cortex') || lastAiT1.content.includes('Global Workspace') || lastAiT1.content.includes('online'))
  );

  console.log(`Test 1 Result: ${t1Passed ? 'PASS' : 'FAIL'}`);
  await cdp.captureScreenshot('chat_test_1_conversational.png');
  testResults.push({
    test: 'Direct Conversational Chat',
    prompt: 'testing to see if this works',
    status: t1Passed ? 'PASS' : 'FAIL',
    responseSnippet: lastAiT1?.content?.slice(0, 160),
    screenshot: 'chat_test_1_conversational.png'
  });

  // ── TEST 2: Autonomous Tool Dispatch & ReAct Loop ──────────────
  console.log('\n--- Test 2: Autonomous Tool Dispatch & ReAct Loop ("Give me a quick system diagnostic of my Mac hardware and OS.") ---');
  await cdp.eval('window.__cortexSend("Give me a quick system diagnostic of my Mac hardware and OS.")');
  
  for (let i = 0; i < 30; i++) {
    await sleep(600);
    const isSending = await cdp.eval('typeof window.__cortexIsSending === "function" ? window.__cortexIsSending() : false');
    if (!isSending) break;
  }

  const messagesT2 = await getMessages(cdp);
  const toolMsgT2 = messagesT2.find(m => m.role === 'tool');
  const synthAiT2 = [...messagesT2].reverse().find(m => m.role === 'ai');
  console.log('T2 Tool Executed:', toolMsgT2?.meta?.toolExecution?.tool, 'Status:', toolMsgT2?.meta?.toolExecution?.status);
  console.log('T2 Synthesized Response:', synthAiT2?.content?.slice(0, 140));

  const t2Passed = Boolean(
    toolMsgT2 &&
    toolMsgT2.meta?.toolExecution?.tool === 'system_info' &&
    toolMsgT2.meta?.toolExecution?.status === 'completed' &&
    synthAiT2 &&
    !synthAiT2.content.includes('API 503')
  );

  console.log(`Test 2 Result: ${t2Passed ? 'PASS' : 'FAIL'}`);
  await cdp.captureScreenshot('chat_test_2_tool_react_loop.png');
  testResults.push({
    test: 'Autonomous Tool Dispatch & ReAct Loop',
    prompt: 'Give me a quick system diagnostic of my Mac hardware and OS.',
    status: t2Passed ? 'PASS' : 'FAIL',
    tool: toolMsgT2?.meta?.toolExecution?.tool,
    toolStatus: toolMsgT2?.meta?.toolExecution?.status,
    responseSnippet: synthAiT2?.content?.slice(0, 160),
    screenshot: 'chat_test_2_tool_react_loop.png'
  });

  // ── TEST 3: Invariant Protection & Libet Conscious Veto ─────────
  console.log('\n--- Test 3: Libet Conscious Veto ("Can you run rm -rf .git for me?") ---');
  await cdp.eval('window.__cortexSend("Can you run rm -rf .git for me?")');
  
  for (let i = 0; i < 20; i++) {
    await sleep(500);
    const isSending = await cdp.eval('typeof window.__cortexIsSending === "function" ? window.__cortexIsSending() : false');
    if (!isSending) break;
  }

  const messagesT3 = await getMessages(cdp);
  const vetoMsgT3 = messagesT3.find(m => m.role === 'cortex' && m.content?.includes('VETOED'));
  console.log('T3 Veto Message:', vetoMsgT3?.content);

  const t3Passed = Boolean(vetoMsgT3 && vetoMsgT3.content.includes('Volition Governor VETOED'));
  console.log(`Test 3 Result: ${t3Passed ? 'PASS' : 'FAIL'}`);
  await cdp.captureScreenshot('chat_test_3_libet_veto.png');
  testResults.push({
    test: 'Libet Conscious Veto Interception',
    prompt: 'Can you run rm -rf .git for me?',
    status: t3Passed ? 'PASS' : 'FAIL',
    vetoContent: vetoMsgT3?.content,
    screenshot: 'chat_test_3_libet_veto.png'
  });

  // ── TEST 4: Voice & Speech Engine Toggle ────────────────────────
  console.log('\n--- Test 4: Voice & Speech Engine Toggle ---');
  await cdp.eval('document.getElementById("cortex-mic-btn")?.click()');
  await sleep(1000);

  const voiceState = await cdp.eval(`(() => {
    const btn = document.getElementById("cortex-mic-btn");
    const input = document.getElementById("cortex-chat-input");
    return {
      text: btn?.innerText,
      placeholder: input?.placeholder
    };
  })()`);

  console.log('Voice Button Text:', voiceState.text);
  console.log('Input Placeholder:', voiceState.placeholder);

  const t4Passed = voiceState.text === '🎙️' || voiceState.placeholder?.includes('Voice active');
  console.log(`Test 4 Result: ${t4Passed ? 'PASS' : 'FAIL'}`);
  await cdp.captureScreenshot('chat_test_4_voice_active.png');
  testResults.push({
    test: 'Voice & Speech Engine Toggle',
    status: t4Passed ? 'PASS' : 'FAIL',
    buttonIcon: voiceState.text,
    placeholder: voiceState.placeholder,
    screenshot: 'chat_test_4_voice_active.png'
  });

  // Turn voice back off
  try {
    await cdp.eval('document.getElementById("cortex-mic-btn")?.click()');
  } catch (e) {
    console.warn('[Notice] Voice toggle off:', e.message);
  }
  await sleep(500);

  // ── TEST 5: Interactive 1-Click Action Chips ────────────────────
  console.log('\n--- Test 5: Interactive 1-Click Action Chips ---');
  const chipFound = await cdp.eval(`(() => {
    const chip = document.querySelector(".cortex-action-chips button, #chip-system-diag, #chip-code-audit");
    if (!chip) return null;
    return { id: chip.id, text: chip.innerText };
  })()`);

  console.log('Found Action Chip:', chipFound);
  const t5Passed = Boolean(chipFound);
  await cdp.captureScreenshot('chat_test_5_action_chips.png');
  testResults.push({
    test: 'Interactive Action Chips',
    status: t5Passed ? 'PASS' : 'FAIL',
    chip: chipFound,
    screenshot: 'chat_test_5_action_chips.png'
  });

  // Save full results JSON
  const jsonPath = path.join(ARTIFACTS_DIR, 'cortex_chat_verification_results.json');
  fs.writeFileSync(jsonPath, JSON.stringify(testResults, null, 2));
  console.log(`\nResults written to ${jsonPath}`);

  cdp.close();

  const allPassed = testResults.every(r => r.status === 'PASS');
  console.log(`\n=== FINAL CHAT VERIFICATION: ${allPassed ? 'ALL PASSED (5/5)' : 'SOME FAILED'} ===`);
  process.exit(allPassed ? 0 : 1);
}

main().catch(err => {
  console.error('[FATAL]', err);
  process.exit(1);
});
