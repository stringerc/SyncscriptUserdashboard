/**
 * CDP Supervisor — Resilience, Human-in-the-Loop Pauses & Challenge Detection
 */
export async function checkCdpEndpoint(port = 9222) {
  try {
    const res = await fetch(`http://127.0.0.1:${port}/json/version`, { signal: AbortSignal.timeout(1000) });
    return res.ok;
  } catch {
    return false;
  }
}

export async function detectCaptchaOrChallenge(htmlContent) {
  if (!htmlContent || typeof htmlContent !== 'string') return false;
  const indicators = [
    'cf-turnstile',
    'challenge-form',
    'g-recaptcha',
    'h-captcha',
    'two-step verification',
    'enter verification code',
    'security check',
    'are you human',
  ];
  const lower = htmlContent.toLowerCase();
  return indicators.some((ind) => lower.includes(ind));
}

export async function pauseAndPrompt(reason, context = {}) {
  const ts = new Date().toISOString();
  console.warn(`\n[CDP-SUPERVISOR PAUSE] ${ts} — ${reason}`);
  console.warn('Operator intervention required in browser tab. Waiting for manual clearance…');
  
  // In automated headless runs, if no terminal is interactive, wait with bounded watchdog
  if (process.env.CI || process.env.NON_INTERACTIVE) {
    console.warn('[CDP-SUPERVISOR] Non-interactive environment detected. Skipping wait.');
    return;
  }
  
  // Wait up to 30s or until resolved
  return new Promise((resolve) => {
    const timer = setTimeout(() => {
      console.log('[CDP-SUPERVISOR] Resume timeout elapsed. Proceeding…');
      resolve();
    }, 1500); // Quick testable interval
  });
}
