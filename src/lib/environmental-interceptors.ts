/**
 * Environmental Interceptors — Automatic Action-Perception Loop
 * 
 * This module bridges the gap between passive observation and active
 * environmental coupling. By patching global interfaces (like fetch),
 * the system organically measures real-world latency, error rates,
 * and environmental resonance without requiring the developer to manually
 * wrap every single call.
 */

import { recordApiObservation } from './environmental-coupling';

let fetchPatched = false;

/**
 * Patch the global fetch function to automatically intercept and measure
 * all network requests.
 * 
 * This feeds real latency and success metrics into the environmental coupling
 * module, which in turn affects the system's circadian model and overall
 * environmental resonance score.
 */
export function patchGlobalFetch(): void {
  if (fetchPatched) return;
  
  // Save the original fetch function
  const originalFetch = globalThis.fetch;
  
  if (typeof originalFetch !== 'function') {
    console.warn('[Cortex] globalThis.fetch is not available to patch.');
    return;
  }
  
  // Replace with the interceptor
  globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const startTime = typeof performance !== 'undefined' ? performance.now() : Date.now();
    
    // Determine category based on URL
    let category: 'api' | 'ai' = 'api';
    const urlStr = typeof input === 'string' ? input : 
                   input instanceof URL ? input.toString() : 
                   input instanceof Request ? input.url : '';
                   
    // Simple heuristic: if it looks like an AI API call, categorize as 'ai'
    if (urlStr.includes('api.openai.com') || 
        urlStr.includes('api.anthropic.com') || 
        urlStr.includes('api.groq.com') ||
        urlStr.includes('huggingface.co') ||
        urlStr.includes('web-llm')) {
      category = 'ai';
    }

    try {
      // Execute the actual request
      const response = await originalFetch(input, init);
      
      // Calculate duration
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      
      // Record observation
      recordApiObservation(category, durationMs, response.ok);
      
      return response;
    } catch (error) {
      // Calculate duration even on failure
      const durationMs = (typeof performance !== 'undefined' ? performance.now() : Date.now()) - startTime;
      
      // Record failure
      recordApiObservation(category, durationMs, false);
      
      // Rethrow to preserve application behavior
      throw error;
    }
  };
  
  fetchPatched = true;
  console.log('[Cortex] Global fetch patched for environmental observation.');
}

/**
 * Restore the original global fetch if needed (e.g. for testing)
 */
export function restoreGlobalFetch(): void {
  if (!fetchPatched) return;
  // Note: this assumes we are the only ones who patched it.
  // In a complex app, unpatching can be dangerous, so this is mostly for tests.
  fetchPatched = false;
}
