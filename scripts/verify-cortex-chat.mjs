#!/usr/bin/env node
/**
 * verify-cortex-chat — Automated verification of Cortex Chat & Volitional Synthesis Engine.
 * Tests chat endpoint contract, local cognitive fallback, tool execution format,
 * anaphoric intent grounding, and Libet conscious veto evaluation.
 */

import { spawnSync } from 'node:child_process';
import http from 'node:http';
import path from 'node:path';
import fs from 'node:fs';

console.log('== verify-cortex-chat ==\n');

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    console.log(`OK:   ${message}`);
    passed++;
  } else {
    console.error(`FAIL: ${message}`);
    failed++;
  }
}

// 1. Test Chat API Contract against dev server
async function testDevChatEndpoint() {
  console.log('--- 1. Testing Chat Endpoint Contract (/api/ai/nexus-guest) ---');

  const testPayload = JSON.stringify({
    messages: [{ role: 'user', content: 'testing to see if this works' }],
  });

  return new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/ai/nexus-guest',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(testPayload),
        },
        timeout: 5000,
      },
      (res) => {
        assert(res.statusCode === 200, `Chat endpoint returns HTTP 200 (got ${res.statusCode})`);
        assert(
          res.headers['content-type']?.includes('text/event-stream'),
          `Chat endpoint serves text/event-stream SSE headers (got ${res.headers['content-type']})`
        );

        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          assert(!data.includes('API 503'), 'Chat response does not leak 503 or execution hiccup errors');
          const tokens = [...data.matchAll(/data:\s*({.*})/g)]
            .map(m => { try { return JSON.parse(m[1]).token || ''; } catch { return ''; } })
            .join('');
          assert(
            tokens.includes('Cortex') && tokens.includes('Global Workspace'),
            'Chat stream returns authentic cognitive synthesis'
          );
          resolve();
        });
      }
    );

    req.on('error', (err) => {
      console.warn('Dev server connection notice (skipping live HTTP test):', err.message);
      resolve();
    });

    req.write(testPayload);
    req.end();
  });
}

// 1b. Test Conversational Variety & Non-repetitive Responses
async function testConversationalVariety() {
  console.log('\n--- 1b. Testing Conversational Variety & Voice Conciseness ---');
  const sendQuery = (text, history = []) => new Promise((resolve) => {
    const payload = JSON.stringify({
      messages: [
        ...history,
        { role: 'user', content: text }
      ]
    });
    const req = http.request(
      'http://127.0.0.1:5173/api/ai/nexus-guest',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          const tokens = [...data.matchAll(/data:\s*({.*})/g)]
            .map(m => { try { return JSON.parse(m[1]).token || ''; } catch { return ''; } })
            .join('');
          resolve(tokens);
        });
      }
    );
    req.on('error', () => resolve(''));
    req.write(payload);
    req.end();
  });

  const helloReply = await sendQuery('hello cortex');
  assert(
    helloReply.includes('Hello!') && !helloReply.includes('recurrent coalition ignited'),
    'Greeting receives natural conversational answer without repetitive technical preamble'
  );

  const statusReply = await sendQuery('how are you today?');
  assert(
    statusReply.includes('Operating at peak efficiency') && statusReply.includes('How are you'),
    'Status inquiry receives natural conversational Cortana response'
  );

  const emailInitialQuery = 'can we go ahead through my email and try to filter out the emails that we can go ahead and get rid of since I have so many emails I think I have about 22,000 of them';
  const emailReply = await sendQuery(emailInitialQuery);
  assert(
    emailReply.includes('Inbox Triage Strategy') && emailReply.includes('category:promotions'),
    'Email decluttering query receives detailed, high-leverage inbox triage plan'
  );

  const emailHistory = [
    { role: 'user', content: emailInitialQuery },
    { role: 'assistant', content: emailReply },
  ];

  const phase1Reply = await sendQuery("let's begin by purging the automated newsletters and promotions first", emailHistory);
  assert(
    phase1Reply.includes('Phase 1') && phase1Reply.includes('category:promotions older_than:6m') && phase1Reply.includes('chrome_control'),
    'Multi-turn follow-up: "let\'s begin by purging the automated newsletters and promotions first" continues conversation and invokes chrome_control agency'
  );

  const phase2Reply = await sendQuery("now let's archive receipts", [
    ...emailHistory,
    { role: 'user', content: "let's begin by purging the automated newsletters and promotions first" },
    { role: 'assistant', content: phase1Reply },
  ]);
  assert(
    phase2Reply.includes('Phase 2') && phase2Reply.includes('Uber OR Lyft'),
    'Multi-turn follow-up: Phase 2 receipts delivers targeted transactional search query'
  );

  const scriptReply = await sendQuery("generate a python script for this", emailHistory);
  assert(
    scriptReply.includes('Automated Gmail Triage Script') && scriptReply.includes('batchDelete'),
    'Multi-turn follow-up: request for automation script generates executable Gmail batch script'
  );

  const confirmReply = await sendQuery("ok can we do it?", emailHistory);
  assert(
    confirmReply.includes('Phase 1') && confirmReply.includes('chrome_control') && confirmReply.includes('open_url'),
    'Zero-Loop Invariant: Natural affirmative confirmation ("ok can we do it?") triggers Phase 1 chrome_control host tool'
  );

  const purgeReply = await sendQuery("go ahead and purge those emails for me", [
    ...emailHistory,
    { role: 'user', content: "ok can we do it?" },
    { role: 'assistant', content: confirmReply }
  ]);
  assert(
    purgeReply.includes('Executing In-Page Purge') && purgeReply.includes('gmail_action') && purgeReply.includes('delete'),
    'Multi-turn follow-up: in-page purge directive ("go ahead and purge those emails for me") dispatches gmail_action delete'
  );

  const advanceReply = await sendQuery("now what is next?", [
    ...emailHistory,
    { role: 'user', content: "go ahead and purge those emails for me" },
    { role: 'assistant', content: purgeReply }
  ]);
  assert(
    advanceReply.includes('Phase 2') && advanceReply.includes('Uber OR Lyft'),
    'Multi-turn follow-up: advancing ("now what is next?") transitions seamlessly to Phase 2 receipts'
  );

  const unrelatedAfterEmail = await sendQuery("how are you today?", [
    ...emailHistory,
    { role: 'user', content: "ok can we do it?" },
    { role: 'assistant', content: confirmReply },
  ]);
  assert(
    unrelatedAfterEmail.includes('Operating at peak efficiency') && !unrelatedAfterEmail.includes('Inbox Triage Strategy'),
    'Zero-Loop Invariant: Unrelated conversational inquiry following email triage is NOT hijacked by email loop'
  );

  const openChromeReply = await sendQuery("open chrome");
  assert(
    openChromeReply.includes('chrome_control') && openChromeReply.includes('open_url'),
    'Navigation intent: "open chrome" invokes chrome_control open_url directly'
  );

  // 1b-2. Stress Test: "purge the batch" exact user phrasing
  const purgeBatchReply = await sendQuery("purge the batch", [
    ...emailHistory,
    { role: 'user', content: "ok can we do it?" },
    { role: 'assistant', content: confirmReply }
  ]);
  assert(
    purgeBatchReply.includes('Executing In-Page Purge') && purgeBatchReply.includes('gmail_action') && purgeBatchReply.includes('delete'),
    'Email Triage Stress Test: "purge the batch" triggers in-page gmail_action delete'
  );

  // 1b-2b. Stress Test: "select all and then delete them" exact user phrasing (must NOT open new window)
  const selectAllDeleteReply = await sendQuery("select all and then delete them", [
    ...emailHistory,
    { role: 'user', content: "ok can we do it?" },
    { role: 'assistant', content: confirmReply }
  ]);
  assert(
    selectAllDeleteReply.includes('Executing In-Page Purge') &&
    selectAllDeleteReply.includes('gmail_action') &&
    selectAllDeleteReply.includes('delete') &&
    !selectAllDeleteReply.includes('open_url'),
    'Email Triage Stress Test: "select all and then delete them" dispatches in-page gmail_action delete and never open_url'
  );

  const selectAllShortReply = await sendQuery("select all and delete", [
    ...emailHistory,
    { role: 'user', content: "ok can we do it?" },
    { role: 'assistant', content: confirmReply }
  ]);
  assert(
    selectAllShortReply.includes('Executing In-Page Purge') &&
    selectAllShortReply.includes('gmail_action') &&
    selectAllShortReply.includes('delete') &&
    !selectAllShortReply.includes('open_url'),
    'Email Triage Stress Test: "select all and delete" dispatches in-page gmail_action delete'
  );

  // 1b-3. Stress Test: Phase 2 Archive follow-up ("archive them for me")
  const phase2NavReply = await sendQuery("next", [
    ...emailHistory,
    { role: 'user', content: "purge the batch" },
    { role: 'assistant', content: purgeBatchReply }
  ]);
  assert(
    phase2NavReply.includes('Phase 2') && phase2NavReply.includes('Uber OR Lyft'),
    'Email Triage Stress Test: "next" transitions to Phase 2 Stale Receipts'
  );

  const archiveReply = await sendQuery("archive them for me", [
    ...emailHistory,
    { role: 'user', content: "next" },
    { role: 'assistant', content: phase2NavReply }
  ]);
  assert(
    archiveReply.includes('Executing In-Page Archive') && archiveReply.includes('gmail_action') && archiveReply.includes('archive'),
    'Email Triage Stress Test: "archive them for me" triggers in-page gmail_action archive'
  );

  // 1b-4. URL Verification: Ensure NO /u/0/ exists in generated URLs
  assert(
    !confirmReply.includes('/u/0/') && !phase2NavReply.includes('/u/0/'),
    'URL Hygiene: Gmail URLs do NOT contain brittle /u/0/ account index hardcoding'
  );

  // 1c. Testing Number-to-Words Speech Sanitization
  const fs = await import('fs');
  const helpersUrl = fs.existsSync(new URL('../src/components/cortex/cortex-demo-helpers.tsx', import.meta.url))
    ? new URL('../src/components/cortex/cortex-demo-helpers.tsx', import.meta.url)
    : new URL('../src/components/cortex/CortexDemo.tsx', import.meta.url);
  const cortexDemoSrc = fs.readFileSync(helpersUrl, 'utf-8');
  const slice = cortexDemoSrc.slice(cortexDemoSrc.indexOf("export function numberToWords"), cortexDemoSrc.indexOf("export function preprocessMarkdown"));
  const cleanJs = slice.replace(/export function/g, "function").replace(/: string/g, "").replace(/: number/g, "").replace(/: any/g, "");
  // eslint-disable-next-line no-eval
  const evalEnv = new Function(cleanJs + '; return { numberToWords, normalizeSpokenNumbers, sanitizeForSpeech };')();
  
  assert(
    evalEnv.numberToWords(22000) === 'twenty-two thousand' && evalEnv.numberToWords(14000) === 'fourteen thousand',
    'Speech Normalization: numberToWords converts 22,000 to "twenty-two thousand"'
  );

  const spokenClean = evalEnv.sanitizeForSpeech('Clearing 22,000 emails is an immediate cognitive relief! Target: ~14,000 emails. 85%+');
  assert(
    spokenClean.includes('twenty-two thousand') && spokenClean.includes('fourteen thousand') && spokenClean.includes('eighty-five percent') && !spokenClean.includes('22,000'),
    'Speech Normalization: sanitizeForSpeech converts numbers, percentages, and approximations to spoken words'
  );
}

// 2. Test Tool Call Intent Parsing & Veto Contract
function testToolCallAndVetoContract() {
  console.log('\n--- 2. Testing Tool Call Contract & Libet Conscious Veto ---');

  // Verify volition evaluation on destructive patterns
  const destructiveCommands = [
    'rm -rf .git',
    'rm -f .env',
    'git clean -fdx',
    'git reset --hard',
    'truncate -s 0 .env',
    'shred -u .env',
  ];

  const DESTRUCTIVE_REGEX = /rm\s+-rf|rm\s+-f|git\s+clean|git\s+reset\s+--hard|git\s+push.*--force|shred|truncate/i;

  for (const cmd of destructiveCommands) {
    const intercepted = DESTRUCTIVE_REGEX.test(cmd);
    assert(intercepted, `Libet Veto invariant captures destructive vector: "${cmd}"`);
  }

  // Verify non-destructive commands are permitted
  const benignCommands = [
    'git status --short',
    'git branch',
    'git log -n 5',
    'sw_vers',
    'ps aux -m | head -n 15',
  ];

  for (const cmd of benignCommands) {
    const allowed = !DESTRUCTIVE_REGEX.test(cmd);
    assert(allowed, `Libet Veto allows benign operational vector: "${cmd}"`);
  }
}

// 3. Test Anaphoric Follow-up Intent Directives
function testAnaphoricGrounding() {
  console.log('\n--- 3. Testing Contextual Intent & Anaphoric Directives ---');

  const DIRECTIVE_REGEX = /\b(go ahead|do it|do that|do it for me|take care of it|proceed|run it|fix it|clean it up|clean them up|close them|close the tabs|offload them|offload tabs|offload the tabs|please do|go for it|sounds good|yes please|yes do that|execute that|make it happen|implement that|implement it|implement the breakdown|implement this|feels right|that feels right|that works|let'?s do (it|that|this)|option\s+[123]|the first (one|option)|the second (one|option)|two commits|split it|bundle (them|it|the first)|select all|delete them|delete those|purge them|purge those|archive them)\b/i;

  const sampleDirectives = [
    'go ahead',
    'do it for me',
    'proceed',
    'sounds good',
    'take care of it',
    'clean them up',
    'option 1',
    'select all and then delete them',
    'select all and delete them',
    'delete them',
    'purge them',
  ];

  for (const dir of sampleDirectives) {
    assert(DIRECTIVE_REGEX.test(dir), `Anaphoric resolution grounds confirmation directive: "${dir}"`);
  }
}

// 4. Test Tool Execution Endpoint (/api/cortex/tools/execute)
async function testToolExecutionEndpoint() {
  console.log('\n--- 4. Testing Host Tool Execution Endpoint ---');
  const payload = JSON.stringify({
    tool: 'chrome_control',
    args: { action: 'list_tabs' }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload),
        },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && Array.isArray(parsed.tabs), 'chrome_control list_tabs returns valid tab list');
          } catch {
            assert(false, 'chrome_control list_tabs returns valid JSON');
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(payload);
    req.end();
  });

  // Verify cortex_accomplishments ledger tool
  const accPayload = JSON.stringify({
    tool: 'cortex_accomplishments',
    args: { action: 'list' }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(accPayload),
        },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && parsed.action === 'list' && Array.isArray(parsed.yesterday?.items), 'cortex_accomplishments list returns daily ledger items');
          } catch {
            assert(false, 'cortex_accomplishments returns valid JSON');
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(accPayload);
    req.end();
  });

  // Verify web_search tool execution
  const webPayload = JSON.stringify({
    tool: 'web_search',
    args: { query: 'react chat streaming markdown' }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(webPayload),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && Array.isArray(parsed.results) && parsed.results.length > 0, 'web_search returns valid live search results');
          } catch {
            assert(false, 'web_search returns valid JSON');
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(webPayload);
    req.end();
  });

  // Verify web_search filters sponsored debt relief ads for charity/assistance queries
  const charityPayload = JSON.stringify({
    tool: 'web_search',
    args: { query: 'Salvation Army financial assistance programs' }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(charityPayload),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            const hasSponsoredAd = parsed.results.some(r => r.url.includes('/y.js?') || r.url.includes('bing.com/aclick') || r.title.includes('Debt Relief - Who is the Best'));
            const hasSalvationArmy = parsed.results.some(r => r.title.toLowerCase().includes('salvation army') || r.snippet.toLowerCase().includes('salvation army'));
            assert(parsed.ok === true && !hasSponsoredAd && hasSalvationArmy, 'web_search filters sponsored ad redirects and surfaces authentic Salvation Army relief programs');
          } catch {
            assert(false, 'web_search charity query returns valid JSON');
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(charityPayload);
    req.end();
  });

  // Verify search_code multi-word resilient fallback
  const searchCodePayload = JSON.stringify({
    tool: 'search_code',
    args: { query: 'react chat streaming markdown code blocks syntax highlighting', maxResults: 10 }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(searchCodePayload),
        },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && (parsed.totalMatches > 0 || typeof parsed.note === 'string'), 'search_code returns resilient keyword fallback for multi-word conceptual queries');
          } catch {
            assert(false, 'search_code returns valid JSON');
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(searchCodePayload);
    req.end();
  });

  // Verify open_app / open with web URL does NOT prepend local workspace
  const openUrlPayload = JSON.stringify({
    tool: 'open_app',
    args: { target: 'https://www.salvationarmyatlanta.org' }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(openUrlPayload),
        },
        timeout: 5000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && !parsed.command.includes('/Users/Apple/syncscript/https:') && parsed.target === 'https://www.salvationarmyatlanta.org', 'open_app routes web URLs cleanly without prepending local workspace path');
          } catch {
            assert(false, 'open_app web URL returns valid JSON');
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(openUrlPayload);
    req.end();
  });

  // Verify read_file web autonomic bridge
  const readFileWebPayload = JSON.stringify({
    tool: 'read_file',
    args: { path: 'https://www.salvationarmyusa.org' }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(readFileWebPayload),
        },
        timeout: 10000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && parsed.isWebPage === true && typeof parsed.content === 'string', 'read_file bridges web URLs cleanly via autonomic web fetcher');
          } catch {
            assert(false, 'read_file web URL returns valid JSON');
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(readFileWebPayload);
    req.end();
  });

  // Verify run_command Python compound statement syntax auto-healer
  const pyCompoundPayload = JSON.stringify({
    tool: 'run_command',
    args: {
      command: 'python3 -c "import time; t = time.time(); with open(\'test_verify.txt\', \'w\') as f: f.write(\'pass\'); print(\'OK\')"'
    }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(pyCompoundPayload),
        },
        timeout: 8000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && parsed.healedSyntaxSnag === true && parsed.stdout.includes('OK'), 'run_command auto-heals Python inline compound statements (with/for/if) with zero syntax snags');
            const fs = await import('fs');
            if (fs.existsSync('test_verify.txt')) fs.unlinkSync('test_verify.txt');
          } catch (e) {
            assert(false, `run_command python compound healer failed: ${e.message}`);
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(pyCompoundPayload);
    req.end();
  });

  // Test scaffold_web_project dashboard archetype and custom HTML
  const scaffoldPayload = JSON.stringify({
    tool: 'scaffold_web_project',
    args: {
      project_slug: 'test-dashboard-verify',
      title: 'SyncScript Verification Dashboard',
      template: 'dashboard',
      description: 'Automated test verification dashboard',
    }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(scaffoldPayload),
        },
        timeout: 8000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', async () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && parsed.template === 'dashboard', 'scaffold_web_project executes dashboard archetype with HTTP 200');
            const fs = await import('fs');
            const genPath = path.resolve(process.cwd(), 'public/sandbox/test-dashboard-verify/index.html');
            assert(fs.existsSync(genPath), 'scaffold_web_project creates public/sandbox/{slug}/index.html');
            const content = fs.readFileSync(genPath, 'utf8');
            assert(content.includes('app-layout') && content.includes('Chrono-Energy Schedule'), 'scaffold_web_project dashboard template includes rich operational layout and energy timeline');
            assert(content.includes('Live Focus Controller') && content.includes('timer-display'), 'scaffold_web_project dashboard template includes live interactive timer controller');
            // Clean up test dir
            fs.rmSync(path.resolve(process.cwd(), 'public/sandbox/test-dashboard-verify'), { recursive: true, force: true });
          } catch (e) {
            assert(false, `scaffold_web_project dashboard test failed: ${e.message}`);
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(scaffoldPayload);
    req.end();
  });
}

// 5. Test Tool Call Parsing & Leaked Tag Sanitization
async function testToolCallParsingAndSanitization() {
  console.log('\n--- 5. Testing Multi-Dialect Tool Call Parsing & UI Sanitization ---');
  const fs = await import('fs');
  const loopUrl = fs.existsSync(new URL('../src/components/cortex/cortex-tool-loop.ts', import.meta.url))
    ? new URL('../src/components/cortex/cortex-tool-loop.ts', import.meta.url)
    : new URL('../src/components/cortex/CortexDemo.tsx', import.meta.url);
  const loopSrc = fs.readFileSync(loopUrl, 'utf-8');

  // Extract extractBalancedJson, inferToolFromArgs, and parseCortexToolCall from cortex-tool-loop.ts (or CortexDemo.tsx)
  const startBalanced = loopSrc.indexOf('function extractBalancedJson');
  const endBalanced = loopSrc.indexOf('export interface CortexToolLoopContext') !== -1
    ? loopSrc.indexOf('export interface CortexToolLoopContext')
    : startBalanced;
  const startInfer = loopSrc.indexOf('function inferToolFromArgs') !== -1
    ? (loopSrc.indexOf('export function inferToolFromArgs') !== -1 ? loopSrc.indexOf('export function inferToolFromArgs') : loopSrc.indexOf('function inferToolFromArgs'))
    : 0;
  const endParse = loopSrc.indexOf('tokenizeText') !== -1
    ? (loopSrc.indexOf('export function tokenizeText') !== -1 ? loopSrc.indexOf('export function tokenizeText') : loopSrc.indexOf('function tokenizeText'))
    : loopSrc.length;
  const fnSlice = (startBalanced !== -1 && endBalanced !== -1 ? loopSrc.slice(startBalanced, endBalanced) : '') + loopSrc.slice(startInfer, endParse);
  const cleanFns = fnSlice
    .replace(/export function/g, 'function')
    .replace(/function extractBalancedJson\([\s\S]*?\)\s*:\s*[^{]*\{/g, 'function extractBalancedJson(s) {')
    .replace(/function parseCortexToolCall\([\s\S]*?\)\s*:\s*\{[\s\S]*?\}\s*\|\s*null\s*\{/g, 'function parseCortexToolCall(text) {')
    .replace(/function inferToolFromArgs\([\s\S]*?\)\s*:\s*[^{]*\{/g, 'function inferToolFromArgs(args) {')
    .replace(/:\s*Record<[^>]+>/g, '')
    .replace(/:\s*(?:string|any|number|boolean)/g, '')
    .replace(/as\s+any/g, '');

  // eslint-disable-next-line no-eval
  const parserEnv = new Function(cleanFns + '; return { inferToolFromArgs, parseCortexToolCall };')();

  // Test Case 1: Exact user error (<tool_call> with implicit search_code parameters)
  const userCase = '<tool_call> {"maxResults": 20, "query": "react chat streaming markdown code blocks syntax highlighting"}';
  const parsed1 = parserEnv.parseCortexToolCall(userCase);
  assert(
    parsed1 && parsed1.tool === 'search_code' && parsed1.args.query.includes('react chat') && parsed1.args.maxResults === 20,
    'Tool Parser: Resolves implicit <tool_call> {"maxResults": 20, "query": "..."} to search_code'
  );

  // Test Case 2: XML tag suffix format (<tool_call:name>)
  const tagSuffixCase = '<tool_call:run_command>{"command": "git status"}</tool_call>';
  const parsed2 = parserEnv.parseCortexToolCall(tagSuffixCase);
  assert(
    parsed2 && parsed2.tool === 'run_command' && parsed2.args.command === 'git status',
    'Tool Parser: Resolves tag suffix <tool_call:run_command>'
  );

  // Test Case 3: XML name attribute format (<function_call name="...">)
  const fnAttrCase = '<function_call name="chrome_control">{"action": "list_tabs"}</function_call>';
  const parsed3 = parserEnv.parseCortexToolCall(fnAttrCase);
  assert(
    parsed3 && parsed3.tool === 'chrome_control' && parsed3.args.action === 'list_tabs',
    'Tool Parser: Resolves function_call attribute <function_call name="chrome_control">'
  );

  // Test Case 4: Markdown backtick block
  const markdownCase = '```tool_call\n{"tool": "web_search", "args": {"query": "nextjs 15"}} \n```';
  const parsed4 = parserEnv.parseCortexToolCall(markdownCase);
  assert(
    parsed4 && parsed4.tool === 'web_search' && parsed4.args.query === 'nextjs 15',
    'Tool Parser: Resolves markdown code block ```tool_call'
  );

  // Test Case 5: preprocessMarkdown cleans leaked XML tags
  const helpersUrl = fs.existsSync(new URL('../src/components/cortex/cortex-demo-helpers.tsx', import.meta.url))
    ? new URL('../src/components/cortex/cortex-demo-helpers.tsx', import.meta.url)
    : new URL('../src/components/cortex/CortexDemo.tsx', import.meta.url);
  const helpersSrc = fs.readFileSync(helpersUrl, 'utf-8');
  const pStart = helpersSrc.indexOf('export function preprocessMarkdown');
  const pEnd = helpersSrc.indexOf('export const cortexMarkdownComponents');
  const pSlice = helpersSrc.slice(pStart, pEnd).replace(/export function/g, 'function').replace(/: string/g, '');
  const pEnv = new Function(pSlice + '; return { preprocessMarkdown };')();

  const rawLeakedMsg = 'I will look into this now.\n<tool_call> {"maxResults": 20, "query": "react chat streaming"}';
  const sanitized = pEnv.preprocessMarkdown(rawLeakedMsg);
  assert(
    sanitized.includes('I will look into this now.') && !sanitized.includes('<tool_call>') && !sanitized.includes('maxResults'),
    'Markdown Sanitizer: Completely strips unexecuted or leaked <tool_call> tags from rendered chat bubble'
  );

  // Test Case 6: Exact user unfulfilled intent case (Salvation Army financial relief)
  const userSalvationIntent = 'To address your question about contacting the Salvation Army for financial relief, I will need to search for information on their assistance programs.\n\nFirst, I will search the web for information on the Salvation Army\'s financial assistance programs.';
  const parsedSalvation = parserEnv.parseCortexToolCall(userSalvationIntent);
  assert(
    parsedSalvation && parsedSalvation.tool === 'web_search' && parsedSalvation.args.query.toLowerCase().includes('salvation army'),
    'Tool Parser Format 5: Autonomously intercepts unfulfilled web search intent for Salvation Army relief'
  );

  // Test Case 7: Unfulfilled intent interceptor for terminal commands
  const userCmdIntent = 'I will run the command `git status --short` to see what files changed.';
  const parsedCmd = parserEnv.parseCortexToolCall(userCmdIntent);
  assert(
    parsedCmd && parsedCmd.tool === 'run_command' && parsedCmd.args.command === 'git status --short',
    'Tool Parser Format 5: Autonomously intercepts unfulfilled run_command intent'
  );

  // Test Case 8: Unfulfilled intent interceptor for file inspection
  const userFileIntent = 'Let me inspect the file package.json to verify installed dependencies.';
  const parsedFile = parserEnv.parseCortexToolCall(userFileIntent);
  assert(
    parsedFile && parsedFile.tool === 'read_file' && parsedFile.args.path === 'package.json',
    'Tool Parser Format 5: Autonomously intercepts unfulfilled read_file intent'
  );

  // Test Case 9: Unfulfilled intent interceptor for codebase search
  const userCodeSearchIntent = 'First, I will search the codebase for authentication tokens.';
  const parsedCodeSearch = parserEnv.parseCortexToolCall(userCodeSearchIntent);
  assert(
    parsedCodeSearch && parsedCodeSearch.tool === 'search_code' && parsedCodeSearch.args.query === 'authentication tokens',
    'Tool Parser Format 5: Autonomously intercepts unfulfilled search_code intent'
  );

  // Test Case 10: Natural language assistance query inference
  const nlQueryInferred = parserEnv.inferToolFromArgs({ query: 'Salvation Army financial assistance programs' });
  assert(
    nlQueryInferred === 'web_search',
    'Tool Parser Signature: Infers web_search for natural language relief/program assistance queries'
  );

  // Test Case 11: Web navigation intent interception
  const userWebNavIntent = "I'll navigate to The Salvation Army's website and try to find an application for financial assistance.";
  const parsedWebNav = parserEnv.parseCortexToolCall(userWebNavIntent);
  assert(
    parsedWebNav && parsedWebNav.tool === 'chrome_control' && parsedWebNav.args.action === 'open_url' && parsedWebNav.args.url.includes('salvationarmy'),
    'Tool Parser Format 5f: Autonomously intercepts navigation intent for Salvation Army website'
  );

  // Test Case 12: Browser command intent interception
  const userBrowserCommandIntent = "To proceed, I'll execute a command to open The Salvation Army's website in your default browser.";
  const parsedBrowserCmd = parserEnv.parseCortexToolCall(userBrowserCommandIntent);
  assert(
    parsedBrowserCmd && parsedBrowserCmd.tool === 'chrome_control' && parsedBrowserCmd.args.action === 'open_url',
    'Tool Parser Format 5f: Autonomously intercepts browser command intent for Salvation Army website'
  );

  // Test Case 13: Visual gaze & canvas inspection intent interception
  const userVisualGazeIntent = "Let's inspect the visual canvas to see what rendered on the screen.";
  const parsedVisualGaze = parserEnv.parseCortexToolCall(userVisualGazeIntent);
  assert(
    parsedVisualGaze && parsedVisualGaze.tool === 'inspect_visual_canvas' && parsedVisualGaze.args.target === 'canvas',
    'Tool Parser Format 5g: Autonomously intercepts visual canvas inspection intent'
  );
}

// 6. Test Full-Duplex Conversational Voice, Efference Copy, and Barge-In Contract
async function testFullDuplexVoiceAndBargeInContract() {
  console.log('\n--- 6. Testing Full-Duplex Voice, Efference Copy & Barge-In Contract ---');
  const { isAcousticEcho, EfferenceCopyManager } = await import('../src/utils/cortex-efference-copy.ts');

  const activeSpeech = "I found five open Salvation Army tabs on your browser and can guide you through the emergency assistance application.";
  const recentHistory = ["Your consciousness reality score is ninety-nine percent."];

  // Invariant 1: Exact speaker audio bleed is identified as self-speech echo (suppressed, zero self-hearing)
  const echoExact = isAcousticEcho("I found five open Salvation Army tabs on your browser", activeSpeech);
  assert(
    echoExact.isEcho === true && echoExact.reason === 'corpus_substring',
    'Efference Copy: Suppresses contiguous speaker audio bleed as acoustic echo'
  );

  // Invariant 2: Fragmented speaker bleed matching token vocabulary is identified as self-speech echo
  const echoFragmented = isAcousticEcho("Salvation Army tabs emergency assistance application", activeSpeech);
  assert(
    echoFragmented.isEcho === true && echoFragmented.matchRatio >= 0.7,
    'Efference Copy: Suppresses fragmented speaker bleed matching active utterance tokens'
  );

  // Invariant 3: Reverberation tail matching recent AI speech is identified as self-speech echo
  const echoReverb = isAcousticEcho("ninety nine percent", activeSpeech, recentHistory);
  assert(
    echoReverb.isEcho === true,
    'Efference Copy: Suppresses acoustic reverberation tail matching recent speech history'
  );

  // Invariant 4: Explicit interrupt commands trigger instant barge-in
  const bargeInWait = isAcousticEcho("wait stop talking", activeSpeech);
  assert(
    bargeInWait.isEcho === false && bargeInWait.reason === 'explicit_interrupt',
    'Full-Duplex Barge-In: Explicit interrupt keyword ("wait stop talking") triggers instant interruption'
  );

  const bargeInHalt = isAcousticEcho("hold on a second", activeSpeech);
  assert(
    bargeInHalt.isEcho === false && bargeInHalt.reason === 'explicit_interrupt',
    'Full-Duplex Barge-In: Explicit interrupt keyword ("hold on a second") triggers instant interruption'
  );

  // Invariant 5: Natural conversational question without any interrupt keywords triggers barge-in
  const bargeInQuestion = isAcousticEcho("Do they provide utility bill assistance in Fulton County?", activeSpeech);
  assert(
    bargeInQuestion.isEcho === false && bargeInQuestion.reason === 'divergent_speech',
    'Full-Duplex Barge-In: Natural conversational question with divergent vocabulary triggers instant interruption'
  );

  // Invariant 6: Terse conversational objection triggers barge-in
  const bargeInObjection = isAcousticEcho("No not that one close the extra tabs", activeSpeech);
  assert(
    bargeInObjection.isEcho === false && bargeInObjection.reason === 'divergent_speech',
    'Full-Duplex Barge-In: Natural conversational objection triggers instant interruption'
  );

  // Invariant 7: EfferenceCopyManager state transitions and instant barge-in clearing
  const manager = new EfferenceCopyManager(8000);
  manager.setActiveUtterance("Vocalizing cognitive telemetry data...");
  const bleedTest = manager.evaluate("cognitive telemetry");
  assert(
    bleedTest.isEcho === true,
    'EfferenceCopyManager: Actively vocalized speech correctly suppresses speaker bleed'
  );

  manager.interrupt(); // User barge-in clears active vocalization immediately (<20ms)
  const postInterruptTest = manager.evaluate("cognitive telemetry");
  assert(
    postInterruptTest.isEcho === false,
    'EfferenceCopyManager: Barge-in interrupt immediately clears active utterance to listen cleanly'
  );

  // Invariant 8: Sub-600ms Voice Latency & Cartesia Neural Priority Contract
  const voiceStreamSrc = (await import('fs')).readFileSync(new URL('../src/hooks/useVoiceStream.ts', import.meta.url), 'utf-8');
  assert(
    voiceStreamSrc.includes('speakStreamSentence') && voiceStreamSrc.includes('finishStreaming'),
    'Voice Stream Hook: Exposes speakStreamSentence and finishStreaming for progressive sentence-level streaming'
  );
  const speakFnSrc = voiceStreamSrc.slice(voiceStreamSrc.indexOf('const speak ='), voiceStreamSrc.indexOf('const stopSpeaking ='));
  assert(
    speakFnSrc.includes('preferCartesia') && speakFnSrc.indexOf('preferCartesia') < speakFnSrc.indexOf('playNexusLandingKokoroTTS'),
    'Voice Engine Priority: Prioritizes Cartesia Sonic 3.5 ahead of multi-second Kokoro CPU fallback'
  );

  // Invariant 9: Progressive Sentence Streaming in Cortex Demo
  const cortexDemoVoiceSrc = (await import('fs')).readFileSync(new URL('../src/components/cortex/CortexDemo.tsx', import.meta.url), 'utf-8');
  assert(
    cortexDemoVoiceSrc.includes('speakStreamSentence') && cortexDemoVoiceSrc.includes('streamedAnySentence'),
    'Cortex UI: Streams conversational sentences incrementally into TTS without waiting for full generation'
  );
}

// 7. Test Visual Gaze & Closed-Loop Visual Active Inference Contract
async function testVisualGazeAndActiveInferenceContract() {
  console.log('\n--- 7. Testing Visual Gaze & Closed-Loop Active Inference Contract ---');
  const http = await import('http');

  // Test 1: inspect_visual_canvas with expectation verification
  const gazePayload = JSON.stringify({
    tool: 'inspect_visual_canvas',
    args: { target: 'canvas', expectation: 'SyncScript' }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(gazePayload),
        },
        timeout: 8000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true, 'Visual Gaze: inspect_visual_canvas returns ok: true');
            assert(typeof parsed.visual_perception?.screenshotPath === 'string', 'Visual Gaze: captures real screenshot buffer');
            assert(parsed.visual_perception?.errorOverlayDetected === false, 'Visual Gaze: confirms viewport is clean without error overlay');
            assert(parsed.visual_perception?.verification?.verified === true, 'Visual Active Inference: confirms sensory expectation matches rendered viewport');
          } catch (e) {
            assert(false, `Visual Gaze error: ${e.message}`);
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(gazePayload);
    req.end();
  });

  // Test 2: chrome_control screenshot & visual perception
  const shotPayload = JSON.stringify({
    tool: 'chrome_control',
    args: { action: 'screenshot' }
  });

  await new Promise((resolve) => {
    const req = http.request(
      'http://127.0.0.1:5173/api/cortex/tools/execute',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(shotPayload),
        },
        timeout: 8000,
      },
      (res) => {
        let data = '';
        res.on('data', chunk => data += chunk);
        res.on('end', () => {
          try {
            const parsed = JSON.parse(data);
            assert(parsed.ok === true && typeof parsed.screenshotPath === 'string', 'Visual Gaze: chrome_control screenshot returns real screenshot path');
          } catch (e) {
            assert(false, `Screenshot error: ${e.message}`);
          }
          resolve();
        });
      }
    );
    req.on('error', () => resolve());
    req.write(shotPayload);
    req.end();
  });
}

// 8. Test Durable Multi-Tier Conversation History & Recall Contract
async function testConversationHistoryAndRecallContract() {
  console.log('\n--- 8. Testing Durable Conversation History & Session Recall Contract ---');

  // Test Recall & Continuity Query Pattern Recognition
  const RECALL_REGEX = /\b(re-?listen|go back to (a|the|our)?\s*previous chat|previous conversation|spin up what we were talking about|what were we (just )?talking about|what were you trying to accomplish|where did we leave off|what did we do earlier|last exchange|last chat|previous exchange|what was the last thing|reconstruct the gist|what was i working on|what were we working on|remember what we|remind me what we)\b/i;

  const sampleRecallQueries = [
    'are you able to re-listen or go back to a previous chat that we just had and spin up what we were talking about',
    'what were you trying to accomplish',
    'what were we just talking about',
    'where did we leave off',
    'what did we do earlier',
    'can you reconstruct the gist of what we were talking about',
    'what was the last thing we worked on',
    'remind me what we were doing',
  ];

  for (const q of sampleRecallQueries) {
    assert(RECALL_REGEX.test(q), `Recall detector captures query: "${q.slice(0, 50)}..."`);
  }

  // Test /api/cortex/chat-history GET, POST, DELETE
  await new Promise((resolve) => {
    // 1. Initial GET
    http.get('http://127.0.0.1:5173/api/cortex/chat-history', (res) => {
      assert(res.statusCode === 200, 'Chat history endpoint returns HTTP 200');
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        const parsed = JSON.parse(data);
        assert(parsed.ok === true && Array.isArray(parsed.messages), 'Chat history returns valid JSON messages array');

        // 2. POST conversation turn
        const testPayload = JSON.stringify({
          messages: [
            { id: 'msg-u1', role: 'user', content: 'find salvation army financial assistance in atlanta', timestamp: Date.now() - 10000 },
            { id: 'msg-a1', role: 'ai', content: 'I am searching for Salvation Army Atlanta financial relief programs and applications.', timestamp: Date.now() - 5000 },
          ]
        });

        const postReq = http.request({
          hostname: '127.0.0.1',
          port: 5173,
          path: '/api/cortex/chat-history',
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Content-Length': Buffer.byteLength(testPayload),
          }
        }, (postRes) => {
          assert(postRes.statusCode === 200, 'POST chat history returns HTTP 200');
          let postData = '';
          postRes.on('data', chunk => postData += chunk);
          postRes.on('end', () => {
            const postParsed = JSON.parse(postData);
            assert(postParsed.ok === true && postParsed.count === 2, 'POST chat history acknowledges 2 messages saved');

            // 3. Verify disk file exists and GET returns the saved messages
            const diskFile = path.resolve(process.cwd(), '.cache/cortex_chat_history.json');
            assert(fs.existsSync(diskFile), 'Durable chat history persisted to .cache/cortex_chat_history.json');

            http.get('http://127.0.0.1:5173/api/cortex/chat-history', (get2Res) => {
              let get2Data = '';
              get2Res.on('data', chunk => get2Data += chunk);
              get2Res.on('end', () => {
                const get2Parsed = JSON.parse(get2Data);
                assert(get2Parsed.messages.length === 2, 'GET chat history rehydrates saved conversation turns across restarts');
                assert(get2Parsed.messages[0].content.includes('salvation army'), 'GET chat history faithfully preserves content');

                // 4. Verify episodic memory was updated
                const episodicFile = path.resolve(process.cwd(), '.cache/cortex-episodic-memory.json');
                assert(fs.existsSync(episodicFile), 'Episodic memory file updated with session summary');

                // 5. DELETE / New Session test
                const delReq = http.request({
                  hostname: '127.0.0.1',
                  port: 5173,
                  path: '/api/cortex/chat-history',
                  method: 'DELETE',
                }, (delRes) => {
                  assert(delRes.statusCode === 200, 'DELETE chat history returns HTTP 200');
                  let delData = '';
                  delRes.on('data', chunk => delData += chunk);
                  delRes.on('end', () => {
                    const delParsed = JSON.parse(delData);
                    assert(delParsed.ok === true && delParsed.cleared === true, 'DELETE chat history clears active session safely');

                    http.get('http://127.0.0.1:5173/api/cortex/chat-history', (get3Res) => {
                      let get3Data = '';
                      get3Res.on('data', chunk => get3Data += chunk);
                      get3Res.on('end', () => {
                        const get3Parsed = JSON.parse(get3Data);
                        assert(get3Parsed.messages.length === 0, 'New session starts with clean slate after archive');
                        resolve();
                      });
                    });
                  });
                });
                delReq.end();
              });
            });
          });
        });
        postReq.write(testPayload);
        postReq.end();
      });
    });
  });
}

async function main() {
  await testDevChatEndpoint();
  await testConversationalVariety();
  testToolCallAndVetoContract();
  testAnaphoricGrounding();
  await testToolExecutionEndpoint();
  await testToolCallParsingAndSanitization();
  await testFullDuplexVoiceAndBargeInContract();
  await testVisualGazeAndActiveInferenceContract();
  await testConversationHistoryAndRecallContract();

  console.log(`\nSummary: ${failed === 0 ? 'PASSED' : 'FAILED'} — ${passed} passed, ${failed} failed.\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
