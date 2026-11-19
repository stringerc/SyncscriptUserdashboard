import { describe, it, expect, vi, beforeEach } from 'vitest';
import { runScenarioSimulation, getSimulationHistory, SIMULATION_PERSONAS } from '../cortex-simulation';

// Mock cortex-memory to avoid network calls during tests
vi.mock('../cortex-memory', () => ({
  retainCortexMemory: vi.fn().mockResolvedValue(true),
  recallCortexMemory: vi.fn().mockResolvedValue(''),
}));

describe('Cortex Scenario Simulation Arena', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('has 4 distinct simulation personas defined with weights summing to 1.0', () => {
    expect(SIMULATION_PERSONAS).toHaveLength(4);
    const sum = SIMULATION_PERSONAS.reduce((acc, p) => acc + p.weight, 0);
    expect(Math.round(sum * 100) / 100).toBe(1.0);
  });

  it('runs scenario simulation and computes consensus score and risk level', async () => {
    const result = await runScenarioSimulation({
      topic: 'Switch authentication tokens to Ed25519 signatures',
      context: 'Modernize session auth and deprecate RSA 2048 keys',
    });

    expect(result.id).toMatch(/^sim-/);
    expect(result.topic).toBe('Switch authentication tokens to Ed25519 signatures');
    expect(result.consensusScore).toBeGreaterThanOrEqual(12);
    expect(result.consensusScore).toBeLessThanOrEqual(98);
    expect(['LOW', 'ELEVATED', 'HIGH', 'CRITICAL']).toContain(result.riskLevel);
    expect(['converged', 'contested', 'blocked']).toContain(result.status);
    expect(result.personaDebates).toHaveLength(4);
    expect(result.topBlockers.length).toBeGreaterThan(0);
    expect(result.recommendedMitigations.length).toBeGreaterThan(0);
  });

  it('throws an error if topic is empty', async () => {
    await expect(runScenarioSimulation({ topic: '   ' })).rejects.toThrow(
      'Simulation topic is required'
    );
  });

  it('stores simulation in history', async () => {
    const beforeCount = getSimulationHistory().length;
    await runScenarioSimulation({ topic: 'Deploy GPU worker pool on RunPod' });
    const after = getSimulationHistory();
    expect(after.length).toBe(beforeCount + 1);
    expect(after[0].topic).toBe('Deploy GPU worker pool on RunPod');
  });
});
