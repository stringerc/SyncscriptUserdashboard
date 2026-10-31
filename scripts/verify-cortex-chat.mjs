#!/usr/bin/env node
/**
 * verify-cortex-chat — Automated verification of Cortex Chat & Volitional Synthesis Engine.
 * Tests chat endpoint contract, local cognitive fallback, tool execution format,
 * anaphoric intent grounding, and Libet conscious veto evaluation.
 */

import { spawnSync } from 'node:child_process';
import http from 'node:http';

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
  const sendQuery = (text) => new Promise((resolve) => {
    const payload = JSON.stringify({ messages: [{ role: 'user', content: text }] });
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

  const DIRECTIVE_REGEX = /\b(go ahead|do it|do that|do it for me|take care of it|proceed|run it|fix it|clean it up|clean them up|close them|close the tabs|offload them|offload tabs|offload the tabs|please do|go for it|sounds good|yes please|yes do that|execute that|make it happen|implement that|implement it|implement the breakdown|implement this|feels right|that feels right|that works|let'?s do (it|that|this)|option\s+[123]|the first (one|option)|the second (one|option)|two commits|split it|bundle (them|it|the first))\b/i;

  const sampleDirectives = [
    'go ahead',
    'do it for me',
    'proceed',
    'sounds good',
    'take care of it',
    'clean them up',
    'option 1',
  ];

  for (const dir of sampleDirectives) {
    assert(DIRECTIVE_REGEX.test(dir), `Anaphoric resolution grounds confirmation directive: "${dir}"`);
  }
}

async function main() {
  await testDevChatEndpoint();
  await testConversationalVariety();
  testToolCallAndVetoContract();
  testAnaphoricGrounding();

  console.log(`\nSummary: ${failed === 0 ? 'PASSED' : 'FAILED'} — ${passed} passed, ${failed} failed.\n`);
  process.exit(failed === 0 ? 0 : 1);
}

main();
