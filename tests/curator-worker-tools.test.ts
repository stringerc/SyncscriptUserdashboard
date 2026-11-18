import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { curatorAuditSelf, curatorRadarAgents, curatorOptimizeAgent } from '../src/lib/cortex-agents/curator-tools';
import { AgentRuntime } from '../src/lib/cortex-agents/runtime';
import { registerAgentWorkers } from '../src/lib/cortex-agents/workers';

describe('Curator Intelligence Engine & Tool Handlers', () => {
  const runtimeDir = path.join(process.cwd(), '.cortex-runtime');
  const capsFile = path.join(runtimeDir, 'dynamic-capabilities.json');

  beforeEach(() => {
    const rt = new AgentRuntime();
    registerAgentWorkers(rt);
  });

  it('curatorAuditSelf audits all host tools and fleet agents, persisting dynamic-capabilities.json with 0 hallucinations', async () => {
    const audit = await curatorAuditSelf();
    expect(audit.ok).toBe(true);
    expect(audit.toolCount).toBeGreaterThanOrEqual(18);
    expect(audit.fleetAgentCount).toBeGreaterThanOrEqual(10);
    expect(audit.hallucinatedToolsCount).toBe(0);
    expect(audit.capabilities.tools).toContain('run_command');
    expect(audit.capabilities.tools).toContain('read_file');
    expect(audit.capabilities.tools).toContain('write_file');
    expect(audit.capabilities.agents).toContain('hermes');
    expect(audit.capabilities.agents).toContain('curator');
    expect(audit.capabilities.agents).toContain('openclaw');
    expect(audit.capabilities.agents).toContain('devin');
    expect(audit.capabilities.agents).toContain('claudecode');
    expect(audit.capabilities.agents).toContain('antigravity');
    expect(audit.capabilities.modalities).toContain('curator_fleet_radar');
    expect(audit.capabilities.effectors).toContain('hermes_tool_execution');
    expect(audit.capabilities.effectors).toContain('run_command');

    expect(fs.existsSync(capsFile)).toBe(true);
    const saved = JSON.parse(fs.readFileSync(capsFile, 'utf-8'));
    expect(saved.toolCount).toBe(audit.toolCount);
    expect(saved.fleetAgentCount).toBe(audit.fleetAgentCount);
  });

  it('curatorRadarAgents probes versions and reports status across all 6 key entities', async () => {
    const radar = await curatorRadarAgents();
    expect(radar.ok).toBe(true);
    expect(radar.targets).toBeDefined();

    // 1. OpenClaw
    expect(radar.targets.openclaw).toBeDefined();
    expect(radar.targets.openclaw.localVersion).toMatch(/^2026\./);
    expect(radar.targets.openclaw.status).toBe('upgrade_available');
    expect(radar.targets.openclaw.testedUpgradePath).toBe('npm install -g openclaw@latest');

    // 2. Devin
    expect(radar.targets.devin).toBeDefined();
    expect(radar.targets.devin.playbookReady).toBe(true);

    // 3. Cortex
    expect(radar.targets.cortex).toBeDefined();
    expect(radar.targets.cortex.status).toBe('verified');

    // 4. Claude Code
    expect(radar.targets.claudecode).toBeDefined();
    expect(radar.targets.claudecode.localVersion).toMatch(/^2\./);
    expect(radar.targets.claudecode.consensusReady).toBe(true);

    // 5. Antigravity
    expect(radar.targets.antigravity).toBeDefined();
    expect(radar.targets.antigravity.orchestrationReady).toBe(true);

    // 6. Hermes
    expect(radar.targets.hermes).toBeDefined();
    expect(typeof radar.targets.hermes.endpointValid).toBe('boolean');
    expect(radar.targets.hermes.advisory).toContain('127.0.0.1:18880');
  });

  it('curatorOptimizeAgent generates elite prompt critique and proposal', async () => {
    const opt = await curatorOptimizeAgent('openclaw', 'Speed up procurement portal navigation');
    expect(opt.ok).toBe(true);
    expect(opt.agentId).toBe('openclaw');
    expect(opt.optimizedPrompt).toContain('0.01% Optimized Operational Directive');
    expect(opt.optimizedPrompt).toContain('Speed up procurement portal navigation');
    expect(opt.proposalId).toBeDefined();
  });
});
