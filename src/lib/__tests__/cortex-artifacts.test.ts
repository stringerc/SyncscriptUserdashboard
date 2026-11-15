import { describe, it, expect } from 'vitest';
import {
  validateArtifacts, extractArtifactsFromResult,
  MAX_ARTIFACTS_PER_MESSAGE, type CortexArtifact,
} from '../cortex-artifacts';

const base = { title: 'Test' };

describe('validateArtifacts', () => {
  it('accepts a valid stat artifact and assigns provenance', () => {
    const { accepted, rejected } = validateArtifacts([{ kind: 'stat', ...base, value: '42%', unit: '%' }], 'emit_artifact');
    expect(rejected).toBe(0);
    expect(accepted).toHaveLength(1);
    const a = accepted[0] as any;
    expect(a.kind).toBe('stat');
    expect(a.id).toBeTruthy();
    expect(a.createdAt).toBeGreaterThan(0);
    expect(a.source).toBe('emit_artifact');
    expect(a.value).toBe('42%');
  });

  it('accepts chart with valid series and sanitizes points', () => {
    const { accepted, rejected } = validateArtifacts([{
      kind: 'chart', title: 'CPU', chartType: 'line',
      series: [{ name: 'cpu', points: [{ x: '00:00', y: 12 }, { x: '00:01', y: 'NaN' }] }],
    }]);
    expect(rejected).toBe(0);
    const s = (accepted[0] as any).series[0];
    expect(s.points[1].y).toBe(0); // non-finite y coerced
  });

  it('rejects chart with no series or bad chartType', () => {
    expect(validateArtifacts([{ kind: 'chart', title: 'x', chartType: 'line', series: [] }]).rejected).toBe(1);
    expect(validateArtifacts([{ kind: 'chart', title: 'x', chartType: 'radar', series: [{ name: 'a', points: [{ x: 1, y: 2 }] }] }]).rejected).toBe(1);
  });

  it('accepts table and image; rejects image without http url', () => {
    const ok = validateArtifacts([
      { kind: 'table', title: 'T', columns: ['a', 'b'], rows: [[1, 'x'], [2, 'y']] },
      { kind: 'image', title: 'I', url: 'https://image.pollinations.ai/prompt/x' },
      { kind: 'image', title: 'Bad', url: 'javascript:alert(1)' },
    ]);
    expect(ok.accepted).toHaveLength(2);
    expect(ok.rejected).toBe(1);
  });

  it('accepts document, map, feed', () => {
    const { accepted, rejected } = validateArtifacts([
      { kind: 'document', title: 'D', format: 'markdown', content: '# Hi' },
      { kind: 'map', title: 'M', summary: 'Duluth → Atlanta' },
      { kind: 'feed', title: 'F', items: [{ label: 'CPU', value: '10%', tone: 'ok' }] },
    ]);
    expect(rejected).toBe(0);
    expect(accepted.map((a) => a.kind)).toEqual(['document', 'map', 'feed']);
  });

  it('caps at MAX_ARTIFACTS_PER_MESSAGE and counts overflow as rejected', () => {
    const many = Array.from({ length: MAX_ARTIFACTS_PER_MESSAGE + 2 }, () => ({ kind: 'stat', title: 's', value: '1' }));
    const { accepted, rejected } = validateArtifacts(many);
    expect(accepted).toHaveLength(MAX_ARTIFACTS_PER_MESSAGE);
    expect(rejected).toBe(2);
  });

  it('rejects unknown kinds, non-objects, and non-arrays gracefully', () => {
    expect(validateArtifacts([{ kind: 'hologram', title: 'x' }]).rejected).toBe(1);
    expect(validateArtifacts(['nope', null, 42]).accepted).toHaveLength(0);
    expect(validateArtifacts('not-array').accepted).toHaveLength(0);
    expect(validateArtifacts(null).rejected).toBe(0);
  });

  it('preserves live flag and liveSource', () => {
    const { accepted } = validateArtifacts([{ kind: 'stat', title: 't', value: '1', live: true, liveSource: 'telemetry' }]);
    expect((accepted[0] as any).live).toBe(true);
    expect((accepted[0] as any).liveSource).toBe('telemetry');
  });
});

describe('extractArtifactsFromResult', () => {
  it('finds artifacts at top level and nested result', () => {
    const art = [{ kind: 'stat', title: 'x', value: '1' }];
    expect(extractArtifactsFromResult({ artifacts: art }, 't')).toHaveLength(1);
    expect(extractArtifactsFromResult({ result: { artifacts: art } }, 't')).toHaveLength(1);
    expect(extractArtifactsFromResult({ ok: true }, 't')).toHaveLength(0);
    expect(extractArtifactsFromResult(null, 't')).toHaveLength(0);
  });

  it('extracts a single artifact object (generate_image shape)', () => {
    const accepted = extractArtifactsFromResult(
      { ok: true, artifact: { kind: 'image', title: 'N', url: 'https://x.test/i.png' } }, 'generate_image');
    expect(accepted).toHaveLength(1);
    expect((accepted[0] as any).provider).toBeUndefined();
  });
});
