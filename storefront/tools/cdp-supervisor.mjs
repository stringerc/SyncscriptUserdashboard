/**
 * CDP Supervisor — Resilience, Human-in-the-Loop Pauses & Challenge Detection
 */
export async function checkCdpEndpoint(port = 9225) {
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

export async function pauseAndPrompt(reason, page = null, maxWaitMs = 60_000) {
  const ts = new Date().toISOString();
  console.warn(`\n[CDP-SUPERVISOR PAUSE] ${ts} — ${reason}`);
  console.warn('Operator intervention required in browser tab. Waiting for clearance…');
  
  if (process.env.CI || process.env.NON_INTERACTIVE) {
    console.warn('[CDP-SUPERVISOR] Non-interactive environment detected. Skipping wait.');
    return false;
  }

  if (!page) {
    return new Promise((resolve) => setTimeout(resolve, 2000));
  }

  // Poll for navigation away from login/challenge/verify
  const start = Date.now();
  while (Date.now() - start < maxWaitMs) {
    try {
      const url = page.url();
      const lower = url.toLowerCase();
      if (!lower.includes('/login') && !lower.includes('signin') && !lower.includes('challenge') && !lower.includes('verify')) {
        console.log(`[CDP-SUPERVISOR] Clearance verified! Proceeding on ${url}…`);
        return true;
      }
    } catch { }
    await new Promise((r) => setTimeout(r, 2000));
  }
  console.warn(`[CDP-SUPERVISOR] Timed out after ${maxWaitMs / 1000}s waiting for manual clearance.`);
  return false;
}
