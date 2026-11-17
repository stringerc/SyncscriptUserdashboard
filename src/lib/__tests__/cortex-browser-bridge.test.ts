import { describe, it, expect, vi } from 'vitest';
import path from 'node:path';
import fs from 'node:fs';

describe('cortex-browser-bridge module', () => {
  it('exports core bridge functions and interfaces', async () => {
    // Dynamic import to verify ESM export signature
    const bridgePath = path.resolve(process.cwd(), 'storefront/tools/cortex-browser-bridge.mjs');
    expect(fs.existsSync(bridgePath)).toBe(true);

    const bridge = await import(bridgePath);
    expect(typeof bridge.isChromeRunning).toBe('function');
    expect(typeof bridge.executeInChrome).toBe('function');
    expect(typeof bridge.ensureTab).toBe('function');
    expect(typeof bridge.injectFileInChrome).toBe('function');
    expect(typeof bridge.publishPlatform).toBe('function');
  });

  it('handles non-existent file injection gracefully', async () => {
    const bridgePath = path.resolve(process.cwd(), 'storefront/tools/cortex-browser-bridge.mjs');
    const bridge = await import(bridgePath);
    const res = await bridge.injectFileInChrome('test.com', 0, '/non/existent/path/file.pdf', 'application/pdf');
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/file not found/i);
  });

  it('rejects unsupported platforms gracefully', async () => {
    const bridgePath = path.resolve(process.cwd(), 'storefront/tools/cortex-browser-bridge.mjs');
    const bridge = await import(bridgePath);
    const res = await bridge.publishPlatform('invalid_platform', {});
    expect(res.ok).toBe(false);
    expect(res.error).toMatch(/unsupported platform/i);
  });
});
