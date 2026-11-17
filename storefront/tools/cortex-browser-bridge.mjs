/**
 * Cortex Browser Bridge — Sovereign macOS Chrome Automation
 *
 * Direct, human-authenticated browser automation via macOS Apple Events (osascript).
 * Bridges agent tasks to your active Google Chrome session without CDP port conflicts,
 * login barriers, or Cloudflare Turnstile blocks.
 */

import { execSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

/**
 * Checks if Google Chrome is currently running on the host.
 */
export async function isChromeRunning() {
  if (process.platform !== 'darwin') return false;
  try {
    const res = spawnSync('pgrep', ['-x', 'Google Chrome']);
    return res.status === 0;
  } catch {
    return false;
  }
}

/**
 * Executes arbitrary JavaScript inside an active Chrome tab matching urlSubstring.
 * @param {string} urlSubstring - Substring to identify the target tab.
 * @param {string} jsCode - The JavaScript code or IIFE to evaluate.
 * @param {number} [timeoutMs=15000] - Timeout in milliseconds.
 * @returns {Promise<{ ok: boolean, data?: any, stdout?: string, stderr?: string, error?: string }>}
 */
export async function executeInChrome(urlSubstring, jsCode, timeoutMs = 15000) {
  if (process.platform !== 'darwin') {
    return { ok: false, error: 'Platform not supported: macOS required for native Apple Events bridge.' };
  }

  const running = await isChromeRunning();
  if (!running) {
    return { ok: false, error: 'Google Chrome is not running.' };
  }

  const tmpJs = path.join(os.tmpdir(), `cortex_js_${Date.now()}_${Math.random().toString(36).slice(2)}.js`);
  try {
    fs.writeFileSync(tmpJs, jsCode, 'utf8');

    const applescript = `
      set jsCode to read "${tmpJs}"
      tell application "Google Chrome"
        repeat with w in windows
          repeat with t in tabs of w
            if (URL of t) contains "${urlSubstring.replace(/"/g, '\\"')}" then
              set res to (execute t javascript jsCode)
              return res
            end if
          end repeat
        end repeat
        return "TAB_NOT_FOUND"
      end tell
    `;

    const res = spawnSync('osascript', ['-e', applescript], {
      timeout: timeoutMs,
      encoding: 'utf8',
    });

    if (res.status !== 0) {
      return {
        ok: false,
        error: res.stderr ? res.stderr.trim() : `AppleScript exit code ${res.status}`,
        stderr: res.stderr,
      };
    }

    const stdout = (res.stdout || '').trim();
    if (stdout === 'TAB_NOT_FOUND') {
      return { ok: false, error: `No active Chrome tab matching: "${urlSubstring}"` };
    }

    let parsedData = stdout;
    try {
      parsedData = JSON.parse(stdout);
    } catch {
      // Return raw string if not JSON
    }

    return { ok: true, data: parsedData, stdout };
  } catch (err) {
    return { ok: false, error: err.message || String(err) };
  } finally {
    try { fs.unlinkSync(tmpJs); } catch {}
  }
}

/**
 * Ensures a tab matching urlSubstring is open. If missing, navigates or opens a new tab.
 */
export async function ensureTab(urlSubstring, targetUrl) {
  if (process.platform !== 'darwin') return { ok: false, error: 'macOS required.' };
  const applescript = `
    tell application "Google Chrome"
      repeat with w in windows
        repeat with t in tabs of w
          if (URL of t) contains "${urlSubstring.replace(/"/g, '\\"')}" then
            return "EXISTS"
          end if
        end repeat
      end repeat
      -- If not found, open new tab
      tell front window
        make new tab with properties {URL:"${targetUrl.replace(/"/g, '\\"')}"}
      end tell
      return "OPENED"
    end tell
  `;
  try {
    const res = spawnSync('osascript', ['-e', applescript], { encoding: 'utf8', timeout: 10000 });
    return { ok: res.status === 0, result: res.stdout.trim() };
  } catch (err) {
    return { ok: false, error: err.message };
  }
}

/**
 * Injects a physical file on disk into a web file dropzone / <input type="file"> via HTML5 DataTransfer.
 */
export async function injectFileInChrome(urlSubstring, selectorOrIndex, filePath, mimeType) {
  if (!fs.existsSync(filePath)) {
    return { ok: false, error: `File not found on disk: ${filePath}` };
  }

  const fileBytes = fs.readFileSync(filePath);
  const b64 = fileBytes.toString('base64');
  const filename = path.basename(filePath);

  const jsPayload = `(() => {
    try {
      const b64 = "${b64}";
      const byteChars = atob(b64);
      const byteNumbers = new Array(byteChars.length);
      for (let i = 0; i < byteChars.length; i++) {
        byteNumbers[i] = byteChars.charCodeAt(i);
      }
      const byteArray = new Uint8Array(byteNumbers);
      const blob = new Blob([byteArray], { type: "${mimeType}" });
      const file = new File([blob], "${filename}", { type: "${mimeType}" });
      
      let input;
      const target = ${JSON.stringify(selectorOrIndex)};
      if (typeof target === 'number') {
        input = document.querySelectorAll('input[type=file]')[target];
      } else {
        input = document.querySelector(target) || document.querySelector('input[type=file]');
      }
      
      if (!input) return JSON.stringify({ ok: false, error: "file input not found for target " + target });
      
      const dt = new DataTransfer();
      dt.items.add(file);
      input.files = dt.files;
      input.dispatchEvent(new Event("change", { bubbles: true }));
      input.dispatchEvent(new Event("input", { bubbles: true }));
      
      return JSON.stringify({ ok: true, filename: "${filename}", size: file.size, filesCount: input.files.length });
    } catch (e) {
      return JSON.stringify({ ok: false, error: e.message });
    }
  })()`;

  return executeInChrome(urlSubstring, jsPayload, 20000);
}

/**
 * High-level multi-platform publisher recipes.
 */
export async function publishPlatform(platform, manifestData = {}) {
  const p = platform.toLowerCase();
  switch (p) {
    case 'gumroad':
      return publishGumroad(manifestData);
    case 'pinterest':
      return publishPinterest(manifestData);
    case 'redbubble':
      return publishRedbubble(manifestData);
    case 'kdp':
    case 'amazon_kdp':
      return publishKdp(manifestData);
    case 'etsy':
      return stageEtsy(manifestData);
    default:
      return { ok: false, error: `Unsupported platform '${platform}'. Supported: gumroad, pinterest, redbubble, kdp, etsy.` };
  }
}

export async function publishGumroad(manifestData) {
  return executeInChrome('gumroad.com', `(() => {
    return JSON.stringify({
      platform: "Gumroad",
      url: window.location.href,
      published: !document.body.innerText.includes("Publishing changes..."),
      title: document.title
    });
  })()`);
}

export async function publishPinterest(manifestData) {
  return executeInChrome('pinterest.com/pin-builder', `(() => {
    const saveBtn = document.querySelector('[data-test-id="board-dropdown-save-button"]');
    if (saveBtn) {
      saveBtn.click();
      return JSON.stringify({ ok: true, action: "published_clicked" });
    }
    return JSON.stringify({ ok: false, error: "Publish button not found" });
  })()`);
}

export async function publishRedbubble(manifestData) {
  return executeInChrome('redbubble.com', `(() => {
    if (document.getElementById("media_design")) document.getElementById("media_design").checked = true;
    if (document.getElementById("media_digital")) document.getElementById("media_digital").checked = true;
    if (document.getElementById("work_safe_for_work_true")) document.getElementById("work_safe_for_work_true").click();
    if (document.getElementById("rightsDeclaration")) document.getElementById("rightsDeclaration").click();
    const submitBtn = document.getElementById("submit-work");
    if (submitBtn && !submitBtn.disabled) {
      submitBtn.click();
      return JSON.stringify({ ok: true, action: "submit_clicked" });
    }
    return JSON.stringify({ ok: false, error: "Submit button disabled or not found" });
  })()`);
}

export async function publishKdp(manifestData) {
  return executeInChrome('kdp.amazon.com', `(() => {
    const isContent = window.location.href.includes('/content');
    const isDetails = window.location.href.includes('/details');
    return JSON.stringify({
      platform: "Amazon KDP",
      url: window.location.href,
      step: isContent ? "content" : (isDetails ? "details" : "other"),
      previewModal: document.body.innerText.includes("Preparing your files...")
    });
  })()`);
}

export async function stageEtsy(manifestData) {
  return executeInChrome('etsy.com', `(() => {
    const onboarding = window.location.href.includes('onboarding');
    return JSON.stringify({
      platform: "Etsy",
      url: window.location.href,
      pendingFee: onboarding && document.body.innerText.includes("$29"),
      requiresHuman: onboarding
    });
  })()`);
}
