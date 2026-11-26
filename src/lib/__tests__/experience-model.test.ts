import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as os from 'node:os';
import * as path from 'node:path';
import {
  ExperienceModel,
  EXPERIENCE_INPUT_DIM,
  EXPERIENCE_HIDDEN_DIM,
  EXPERIENCE_OUTPUT_DIM,
} from '../consciousness/experience-model';

describe('ExperienceModel', () => {
  let tmpDir: string;

  beforeEach(() => { tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'exp-')); });
  afterEach(() => { fs.rmSync(tmpDir, { recursive: true, force: true }); });

  const input = () => Array.from({ length: EXPERIENCE_INPUT_DIM }, (_, i) => 0.1 + i * 0.05);

  it('predicts a bounded 4-dim output and 32-dim embedding', () => {
    const m = new ExperienceModel(path.join(tmpDir, 'm.json'));
    const p = m.predict(input());
    expect(p.outputs).toHaveLength(EXPERIENCE_OUTPUT_DIM);
    expect(p.embedding).toHaveLength(EXPERIENCE_HIDDEN_DIM);
    for (const v of p.outputs) expect(v).toBeGreaterThanOrEqual(0);
    for (const v of p.outputs) expect(v).toBeLessThanOrEqual(1);
  });

  it('starts untrained and becomes trained after minTrustUpdates', () => {
    const m = new ExperienceModel(path.join(tmpDir, 'm.json'));
    expect(m.isTrained).toBe(false);
    expect(m.updateCount).toBe(0);
    for (let i = 0; i < 25; i++) m.update(input(), [0.8, 1, 0.7, 0.6]);
    expect(m.updateCount).toBe(25);
    expect(m.isTrained).toBe(true);
    expect(m.confidence).toBeGreaterThan(0);
  });

  it('learns: predictions move toward consistent targets', () => {
    const m = new ExperienceModel(path.join(tmpDir, 'm.json'));
    const x = input();
    const target = [0.9, 1, 0.8, 0.7];
    const before = m.predict(x).outputs[0];
    for (let i = 0; i < 60; i++) m.update(x, target);
    const after = m.predict(x).outputs[0];
    expect(Math.abs(after - target[0])).toBeLessThan(Math.abs(before - target[0]));
  });

  it('persists weights and reloads update count', () => {
    const p = path.join(tmpDir, 'm.json');
    const m = new ExperienceModel(p);
    for (let i = 0; i < 15; i++) m.update(input(), [0.5, 0.5, 0.5, 0.5]);
    m.flush();
    const m2 = new ExperienceModel(p);
    expect(m2.updateCount).toBe(15);
    expect(m2.isTrained).toBe(false); // 15 < 20 trust threshold
  });
});
