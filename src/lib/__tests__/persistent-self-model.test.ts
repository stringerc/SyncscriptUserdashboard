import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import { PersistentSelfModel } from '../consciousness/persistent-self-model';

describe('PersistentSelfModel disk persistence', () => {
  let tmpDir: string;
  let p: string;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'self-model-'));
    p = path.join(tmpDir, 'self-model.json');
  });
  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('snapshot survives a restart via enableDiskPersistence', () => {
    const m1 = new PersistentSelfModel();
    m1.enableDiskPersistence(p);
    m1.consolidateSession({
      sessionId: 'gal-attention-reset',
      summary: 'test attention episode',
      lessons: ['l1'],
      valence: 0.2,
      salience: 0.5,
      agencyScore: 0.9,
    });
    m1.flush();
    expect(fs.existsSync(p)).toBe(true);

    const m2 = new PersistentSelfModel();
    m2.enableDiskPersistence(p);
    const snap = m2.getSnapshot();
    const found = snap.narrativeIdentity.lifeStoryEpisodes
      .some((e) => e.sessionReference === 'gal-attention-reset');
    expect(found).toBe(true);
    expect(snap.continuityMetrics.sessionCount).toBeGreaterThan(1);
  });

  it('debounced persist still lands after enough mutations', () => {
    const m = new PersistentSelfModel();
    m.enableDiskPersistence(p);
    for (let i = 0; i < 5; i++) {
      m.consolidateSession({
        sessionId: `s-${i}`, summary: 'x', lessons: [], valence: 0, salience: 0, agencyScore: 0.5,
      });
    }
    expect(fs.existsSync(p)).toBe(true);
  });

  it('corrupt snapshot falls back to seeded state, not a crash', () => {
    fs.writeFileSync(p, '{"narrativeIdentity": broken');
    const m = new PersistentSelfModel();
    expect(() => m.enableDiskPersistence(p)).not.toThrow();
    expect(m.getSnapshot().narrativeIdentity.lifeStoryEpisodes.length).toBeGreaterThan(0);
  });
});
