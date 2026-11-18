import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'warden-fi-'));
process.env.CORTEX_AGENTS_STATE_DIR = path.join(tmp, 'state');
const { nodeFileIntegrityProbe, FILE_INTEGRITY_WATCH, FILE_SHRINK_THRESHOLD } = await import('../cortex-agents/warden');

const REPO = path.join(tmp, 'repo');

function writeWatched(lines: number, fill = 'x') {
  for (const rel of FILE_INTEGRITY_WATCH) {
    const abs = path.join(REPO, rel);
    fs.mkdirSync(path.dirname(abs), { recursive: true });
    fs.writeFileSync(abs, Array.from({ length: lines }, (_, i) => `${fill}${i}`).join('\n'));
  }
}

const snapPath = () => path.join(tmp, 'state', 'file-integrity.json');
const backupPath = (rel: string) =>
  path.join(tmp, 'state', 'file-backups', rel.replace(/[^a-zA-Z0-9._-]/g, '_'));

describe('file integrity probe', () => {
  beforeEach(() => {
    fs.rmSync(REPO, { recursive: true, force: true });
    fs.rmSync(path.join(tmp, 'state'), { recursive: true, force: true });
    writeWatched(100);
  });

  it('establishes baseline on first run — all intact, backups written', () => {
    const r = nodeFileIntegrityProbe(REPO)();
    expect(r.truncated).toHaveLength(0);
    expect(r.missing).toHaveLength(0);
    expect(r.detail).toContain('intact');
    const snap = JSON.parse(fs.readFileSync(snapPath(), 'utf-8'));
    expect(snap.files['vite.config.ts'].lines).toBe(100);
    expect(fs.existsSync(backupPath('vite.config.ts'))).toBe(true);
  });

  it('detects >40% truncation and preserves last-good snapshot + backup', () => {
    nodeFileIntegrityProbe(REPO)(); // baseline
    // Simulate the antigravity incident: vite.config.ts 100 → 10 lines.
    fs.writeFileSync(path.join(REPO, 'vite.config.ts'), 'truncated');
    const r = nodeFileIntegrityProbe(REPO)();
    expect(r.truncated.some((t) => t.startsWith('vite.config.ts'))).toBe(true);
    // Snapshot must still hold the last-good line count.
    const snap = JSON.parse(fs.readFileSync(snapPath(), 'utf-8'));
    expect(snap.files['vite.config.ts'].lines).toBe(100);
    // Backup must still hold the good content.
    expect(fs.readFileSync(backupPath('vite.config.ts'), 'utf-8').split('\n').length).toBe(100);
  });

  it('accepts legitimate growth and small edits', () => {
    nodeFileIntegrityProbe(REPO)();
    const abs = path.join(REPO, 'vite.config.ts');
    fs.writeFileSync(abs, fs.readFileSync(abs, 'utf-8') + '\n// new endpoint\n'.repeat(50));
    const r = nodeFileIntegrityProbe(REPO)();
    expect(r.truncated).toHaveLength(0);
    const snap = JSON.parse(fs.readFileSync(snapPath(), 'utf-8'));
    expect(snap.files['vite.config.ts'].lines).toBeGreaterThan(100);
  });

  it('reports missing watched files without touching snapshot', () => {
    nodeFileIntegrityProbe(REPO)();
    fs.unlinkSync(path.join(REPO, 'src/lib/cortex-agents/mission.ts'));
    const r = nodeFileIntegrityProbe(REPO)();
    expect(r.missing).toContain('src/lib/cortex-agents/mission.ts');
    const snap = JSON.parse(fs.readFileSync(snapPath(), 'utf-8'));
    expect(snap.files['src/lib/cortex-agents/mission.ts'].lines).toBe(100);
  });

  it('threshold constant is sane', () => {
    expect(FILE_SHRINK_THRESHOLD).toBeGreaterThan(0.5);
    expect(FILE_SHRINK_THRESHOLD).toBeLessThan(1);
    expect(FILE_INTEGRITY_WATCH).toContain('vite.config.ts');
  });
});
