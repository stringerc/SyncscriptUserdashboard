import { describe, it, expect } from 'vitest';
import { classifyRepoPath, runPatrolChecks, REPO_STALE_HOURS, type RepoHygieneReport } from '../cortex-agents/warden';

const okFetch: any = async () => ({
  ok: true, status: 200,
  json: async () => ({ agents: [], models: [], matrix: {} }),
  text: async () => '',
  body: { getReader: () => ({ read: async () => ({ value: new TextEncoder().encode('data: {}\n\n') }), cancel: async () => {} }) },
});

function baseDeps(repo?: RepoHygieneReport | (() => RepoHygieneReport)) {
  return {
    base: 'http://127.0.0.1:9',
    fetchImpl: okFetch,
    repoProbe: typeof repo === 'function' ? repo : repo ? () => repo : undefined,
  };
}

describe('classifyRepoPath', () => {
  it('marks runtime churn as churn', () => {
    for (const p of [
      '.cortex/bus/state.json', '.cortex-runtime/task-archive.jsonl',
      '.superpowers/sdd/omni-store-syndication/progress.md',
      'tsconfig.tsbuildinfo', 'models.matrix', '__pycache__/x.pyc', 'foo.pyc',
      'public/screenshots/latest-canvas.png',
      'public/screenshots/cortex-crystalline-agents.png',
      'public/screenshots/..latest-canvas.png-2H78',
      'storefront/browser/latest.png', 'storefront/browser/latest.txt',
      'storefront/distribution-queue.json', 'storefront/distribution-dashboard.html',
      'MEMORY.md', 'dream-log.md', 'morning-briefing.md', 'example.txt', '<correct_path>',
      'node_modules/pkg/index.js', 'dist/bundle.js',
    ]) expect(classifyRepoPath(p), p).toBe('churn');
  });

  it('marks real work as real — unknown paths err toward attention', () => {
    for (const p of [
      'src/lib/cortex-counsel.ts', 'vite.config.ts', 'package.json',
      'scripts/counsel-file-position.sh', 'src/components/cortex/CortexFoundryNav.tsx',
      'docs/NEW_SPEC.md', 'some-random-file.txt',
    ]) expect(classifyRepoPath(p), p).toBe('real');
  });
});

describe('runPatrolChecks repo.hygiene', () => {
  it('passes clean when no real dirty files', async () => {
    const r = await runPatrolChecks(baseDeps({ realCount: 0, churnCount: 12, oldestRealAgeH: null, sampleFiles: [] }));
    const c = r.checks.find((x) => x.name === 'repo.hygiene');
    expect(c?.ok).toBe(true);
    expect(c?.detail).toContain('churn');
  });

  it('warns but does not go critical when real work is fresh', async () => {
    const r = await runPatrolChecks(baseDeps({ realCount: 3, churnCount: 0, oldestRealAgeH: 0.5, sampleFiles: ['src/a.ts'] }));
    const c = r.checks.find((x) => x.name === 'repo.hygiene');
    expect(c?.ok).toBe(true);
    expect(c?.detail).toContain('3 real uncommitted');
  });

  it('fails as warning (non-critical) when real work is stale', async () => {
    const r = await runPatrolChecks(baseDeps({ realCount: 2, churnCount: 5, oldestRealAgeH: REPO_STALE_HOURS + 1, sampleFiles: ['src/a.ts', 'vite.config.ts'] }));
    const c = r.checks.find((x) => x.name === 'repo.hygiene');
    expect(c?.ok).toBe(false);
    expect(c?.critical).toBe(false);
    expect(r.warnings.some((w) => w.startsWith('repo.hygiene'))).toBe(true);
    expect(r.anomalies.some((a) => a.startsWith('repo.hygiene'))).toBe(false);
  });

  it('treats deleted/unstat-able paths as maximally stale', async () => {
    const r = await runPatrolChecks(baseDeps({ realCount: 1, churnCount: 0, oldestRealAgeH: 999, sampleFiles: ['src/deleted.ts'] }));
    const c = r.checks.find((x) => x.name === 'repo.hygiene');
    expect(c?.ok).toBe(false);
    expect(c?.detail).toContain('stale-deleted');
  });
});

describe('nodeRepoProbe classification live', () => {
  it('repo probe returns a well-formed report', async () => {
    const { nodeRepoProbe } = await import('../cortex-agents/warden');
    const report = nodeRepoProbe(process.cwd())();
    expect(typeof report.realCount).toBe('number');
    expect(typeof report.churnCount).toBe('number');
    expect(report.sampleFiles.length).toBeLessThanOrEqual(5);
  });
});
