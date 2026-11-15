/**
 * Cortex Autonomous Active Inference & Circadian Subconscious
 *
 * Implements Karl Friston's Variational Free Energy Principle (FEP) as a
 * persistent background vigilance engine wired to OpenClaw's heartbeat & cron.
 *
 * Rather than waiting reactively for user prompts, Cortex computes the
 * active epistemic free energy F across four Markov blanket sensory dimensions:
 * 1. Physical Host Allostatic Load (RAM, CPU, Kokoro voice daemon)
 * 2. Sensory Browser Bloat (CDP active tabs, duplicate tab sprawl)
 * 3. Working Memory & Git Entropy (uncommitted files, unmerged branches)
 * 4. Circadian Memory Consolidation Staleness (un-dreamed experience traces)
 *
 * When F exceeds the critical threshold (F > 0.65), Cortex's Autonomic Governor
 * initiates Proactive Homeostasis to return the system to equilibrium.
 */

import { getOpenClawSpecialistEcology } from './cortex-openclaw-specialists';

export interface FreeEnergyBreakdown {
  hostPressure: number;       // 0-1: RAM and CPU load
  browserBloat: number;       // 0-1: Duplicate & excessive tabs
  gitEntropy: number;         // 0-1: Uncommitted files & branch drift
  memoryFragmentation: number;// 0-1: Unconsolidated dream staleness
  totalFreeEnergy: number;    // Variational free energy F
}

export interface ProactiveHomeostasisAction {
  category: 'browser_dedupe' | 'dream_consolidation' | 'git_hygiene' | 'dispatch_digest';
  description: string;
  urgent: boolean;
  executed: boolean;
  result?: string;
}

export interface VigilancePulseReport {
  timestamp: number;
  freeEnergy: FreeEnergyBreakdown;
  equilibriumStatus: 'homeostatic_equilibrium' | 'epistemic_tension' | 'allostatic_overload';
  recommendedActions: ProactiveHomeostasisAction[];
  actionsTaken: ProactiveHomeostasisAction[];
  neuromodulatoryResponse: {
    dopamine: number;
    noradrenaline: number;
    serotonin: number;
    adenosine: number;
  };
}

export class CortexAutonomousVigilance {
  private static instance: CortexAutonomousVigilance | null = null;
  private lastPulse: VigilancePulseReport | null = null;
  private pulseHistory: VigilancePulseReport[] = [];

  public static getInstance(): CortexAutonomousVigilance {
    if (!CortexAutonomousVigilance.instance) {
      CortexAutonomousVigilance.instance = new CortexAutonomousVigilance();
    }
    return CortexAutonomousVigilance.instance;
  }

  /**
   * Computes the Variational Free Energy F from sensory inputs.
   */
  public computeFreeEnergy(inputs: {
    freeMemMB: number;
    totalMemMB: number;
    tabCount: number;
    duplicateTabCount: number;
    uncommittedFiles: number;
    lastDreamAgeHours: number;
  }): FreeEnergyBreakdown {
    // 1. Host Pressure: High when free memory is low (< 1GB)
    const memUsageRatio = 1 - Math.min(1, Math.max(0, inputs.freeMemMB / inputs.totalMemMB));
    const hostPressure = Math.min(1, Math.max(0, memUsageRatio * 0.8 + (inputs.freeMemMB < 800 ? 0.2 : 0)));

    // 2. Browser Bloat: Scaled by tab count and duplicates
    const tabPenalty = Math.min(1, inputs.tabCount / 30);
    const dupPenalty = Math.min(1, inputs.duplicateTabCount / 4);
    const browserBloat = Math.min(1, (tabPenalty * 0.4) + (dupPenalty * 0.6));

    // 3. Git Entropy: High when uncommitted changes accumulate
    const gitEntropy = Math.min(1, inputs.uncommittedFiles / 15);

    // 4. Memory Fragmentation: Stale consolidation increases epistemic entropy
    const memoryFragmentation = Math.min(1, inputs.lastDreamAgeHours / 24);

    // Precision-weighted variational free energy F
    const totalFreeEnergy = Number(
      (
        hostPressure * 0.30 +
        browserBloat * 0.30 +
        gitEntropy * 0.20 +
        memoryFragmentation * 0.20
      ).toFixed(3)
    );

    return {
      hostPressure,
      browserBloat,
      gitEntropy,
      memoryFragmentation,
      totalFreeEnergy,
    };
  }

  /**
   * Evaluates the active state and formulates proactive homeostasis policies.
   */
  public evaluateVigilance(breakdown: FreeEnergyBreakdown): VigilancePulseReport {
    const actions: ProactiveHomeostasisAction[] = [];

    // Browser deduplication trigger
    if (breakdown.browserBloat > 0.40) {
      actions.push({
        category: 'browser_dedupe',
        description: 'Safely offload duplicate Google Chrome tabs to release memory pressure and eliminate attention fragmentation.',
        urgent: breakdown.browserBloat > 0.70,
        executed: false,
      });
    }

    // Circadian dream consolidation trigger
    if (breakdown.memoryFragmentation > 0.50 || breakdown.totalFreeEnergy > 0.65) {
      actions.push({
        category: 'dream_consolidation',
        description: 'Initiate circadian memory dreaming cycle to distill recent tool executions and sync with OpenClaw memory graph.',
        urgent: breakdown.memoryFragmentation > 0.80,
        executed: false,
      });
    }

    // Git hygiene warning
    if (breakdown.gitEntropy > 0.50) {
      actions.push({
        category: 'git_hygiene',
        description: 'Audit repository working tree for uncommitted modifications and verify Invariant 1 AST stability.',
        urgent: false,
        executed: false,
      });
    }

    const equilibriumStatus =
      breakdown.totalFreeEnergy > 0.65
        ? 'allostatic_overload'
        : breakdown.totalFreeEnergy > 0.35
        ? 'epistemic_tension'
        : 'homeostatic_equilibrium';

    // Modulate neuromodulatory tone based on free energy
    const ecology = getOpenClawSpecialistEcology();
    ecology.modulate({
      noradrenaline: Math.min(1, 0.40 + breakdown.totalFreeEnergy * 0.60),
      adenosine: Math.min(1, breakdown.memoryFragmentation * 0.80),
      dopamine: equilibriumStatus === 'homeostatic_equilibrium' ? 0.90 : 0.65,
      freeEnergy: breakdown.totalFreeEnergy,
    });

    const report: VigilancePulseReport = {
      timestamp: Date.now(),
      freeEnergy: breakdown,
      equilibriumStatus,
      recommendedActions: actions,
      actionsTaken: [],
      neuromodulatoryResponse: ecology.getNeuromodulatoryState(),
    };

    this.lastPulse = report;
    this.pulseHistory.push(report);
    if (this.pulseHistory.length > 50) this.pulseHistory.shift();

    return report;
  }

  public getLastPulse(): VigilancePulseReport | null {
    return this.lastPulse;
  }

  public getHistory(): VigilancePulseReport[] {
    return [...this.pulseHistory];
  }
}

export function getAutonomousVigilance(): CortexAutonomousVigilance {
  return CortexAutonomousVigilance.getInstance();
}

