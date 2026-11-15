import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs';
import * as path from 'node:path';
import * as os from 'node:os';
import { CortexObsidianMemory } from '../cortex-obsidian-memory';

describe('CortexObsidianMemory Substrate', () => {
  let tmpVaultPath: string;
  let memory: CortexObsidianMemory;

  beforeEach(() => {
    tmpVaultPath = path.join(os.tmpdir(), `cortex-vault-test-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`);
    fs.mkdirSync(tmpVaultPath, { recursive: true });
    memory = new CortexObsidianMemory(tmpVaultPath);
  });

  afterEach(() => {
    try {
      fs.rmSync(tmpVaultPath, { recursive: true, force: true });
    } catch {}
  });

  it('initializes standard ai-memory-vault folder structure and index files', () => {
    const success = memory.ensureVaultInitialized();
    expect(success).toBe(true);

    const expectedDirs = [
      '00 - Inbox',
      '01 - Daily Notes',
      '02 - Projects',
      '03 - SyncScript',
      '90 - Personal',
      '91 - Archive',
      '92 - Resources',
    ];

    for (const dir of expectedDirs) {
      expect(fs.existsSync(path.join(tmpVaultPath, dir))).toBe(true);
    }

    expect(fs.existsSync(path.join(tmpVaultPath, 'VAULT-INDEX.md'))).toBe(true);
    expect(fs.existsSync(path.join(tmpVaultPath, 'Active Priorities.md'))).toBe(true);

    const indexContent = fs.readFileSync(path.join(tmpVaultPath, 'VAULT-INDEX.md'), 'utf8');
    expect(indexContent).toContain('VAULT INDEX — CORTEX Cognitive Memory');
    expect(indexContent).toContain('GWT');

    const prioritiesContent = fs.readFileSync(path.join(tmpVaultPath, 'Active Priorities.md'), 'utf8');
    expect(prioritiesContent).toContain('Active Priorities');
  });

  it('creates and appends to daily note in 01 - Daily Notes/', () => {
    memory.ensureVaultInitialized();
    const today = new Date().toISOString().slice(0, 10);
    const dailyNotePath = path.join(tmpVaultPath, '01 - Daily Notes', `${today}.md`);

    expect(fs.existsSync(dailyNotePath)).toBe(true);

    const appended = memory.appendToDailyNote({
      timestamp: new Date().toISOString(),
      role: 'user',
      content: 'Test user instruction for CORTEX memory',
      tags: ['test', 'cortex'],
    });
    expect(appended).toBe(true);

    const content = fs.readFileSync(dailyNotePath, 'utf8');
    expect(content).toContain('👤 User #test #cortex');
    expect(content).toContain('Test user instruction for CORTEX memory');

    const appendedAi = memory.appendToDailyNote({
      timestamp: new Date().toISOString(),
      role: 'ai',
      content: 'CORTEX response: memory acknowledged',
    });
    expect(appendedAi).toBe(true);

    const contentAfterAi = fs.readFileSync(dailyNotePath, 'utf8');
    expect(contentAfterAi).toContain('🤖 CORTEX');
    expect(contentAfterAi).toContain('CORTEX response: memory acknowledged');
  });

  it('writes structured project notes with frontmatter', () => {
    memory.ensureVaultInitialized();
    const written = memory.writeNote(
      '02 - Projects',
      'visualizer-spec',
      '# Visualizer Spec\n\nElite four-face visualizer with PCB and Matrix rain.',
      { status: 'active', priority: 'p0' }
    );
    expect(written).toBe(true);

    const notePath = path.join(tmpVaultPath, '02 - Projects', 'visualizer-spec.md');
    expect(fs.existsSync(notePath)).toBe(true);

    const content = fs.readFileSync(notePath, 'utf8');
    expect(content).toMatch(/status:\s*["']?active["']?/);
    expect(content).toMatch(/priority:\s*["']?p0["']?/);
    expect(content).toContain('# Visualizer Spec');
  });

  it('queries notes and resolves semantic relevance and wikilinks', () => {
    memory.ensureVaultInitialized();
    memory.writeNote(
      '02 - Projects',
      'Quantum-Orchestrator',
      '# Quantum Orchestrator\n\nIntegrates GWT workspace with [[Active Priorities]].'
    );
    memory.writeNote(
      '00 - Inbox',
      'Random-Idea',
      '# Random Idea\n\nUnrelated thought about weather.'
    );

    const results = memory.queryVault('Orchestrator workspace');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].title).toBe('Quantum Orchestrator');
    expect(results[0].links).toContain('Active Priorities');
  });
});
