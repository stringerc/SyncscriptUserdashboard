/**
 * Cortex Continuous Agent Evolution Engine (cortex-agent-evolution.ts)
 *
 * Implements automated fleet review across Cortex's installed skills, dynamic tools,
 * and cognitive modules to continuously maintain performance at elite standards.
 *
 * Core Capabilities:
 * 1. Fleet Review: Audits skills in skills-lock.json against the 8 metacognitive domains.
 * 2. Gap Identification: Flags uncovered operational domains lacking specialized procedures.
 * 3. Autonomous Evolution Proposals: Proposes de-novo tool synthesis or package adoption.
 * 4. Fleet Resilience Metric: Computes a holistic coverage score across the agent fleet.
 */

import { persistentStore } from './persistent-store';
import { getCortexMetacognitionCalibration, type CalibrationDomain } from './cortex-metacognition-calibration';

// ── Types ──────────────────────────────────────────────────────────

export interface SkillAuditEntry {
  name: string;
  source: string;
  sourceType: string;
  skillPath: string;
  isDeNovo: boolean;
  status: 'healthy' | 'needs_update' | 'deprecated';
  lastEvaluated: number;
}

export interface EvolutionAuditReport {
  id: string;
  totalAudited: number;
  healthyCount: number;
  skills: SkillAuditEntry[];
  uncoveredDomains: CalibrationDomain[];
  recommendedSyntheses: string[];
  fleetResilienceScore: number; // 0.0 to 1.0
  timestamp: number;
}

const STORAGE_KEY = 'cortex:agent_evolution:latest_report:v1';

// ── Evolution Engine ───────────────────────────────────────────────

export class CortexAgentEvolutionEngine {
  private latestReport: EvolutionAuditReport | null = null;

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      const raw = persistentStore.getItem(STORAGE_KEY);
      if (raw) {
        this.latestReport = JSON.parse(raw);
      }
    } catch {}
  }

  private saveState(): void {
    if (this.latestReport) {
      try {
        persistentStore.setItem(STORAGE_KEY, JSON.stringify(this.latestReport));
      } catch {}
    }
  }

  /**
   * Evaluates the current fleet of installed skills against metacognitive domain demands.
   */
  public async auditFleet(options?: {
    installedSkills?: Record<string, any>;
  }): Promise<EvolutionAuditReport> {
    const rawSkills = options?.installedSkills || {};
    const skillEntries: SkillAuditEntry[] = [];

    for (const [name, data] of Object.entries(rawSkills)) {
      skillEntries.push({
        name,
        source: data.source || 'internal',
        sourceType: data.sourceType || 'local',
        skillPath: data.skillPath || `skills/${name}/SKILL.md`,
        isDeNovo: Boolean(data.deNovo),
        status: 'healthy',
        lastEvaluated: Date.now(),
      });
    }

    // Map installed skills to domains
    const coveredDomains = new Set<string>();
    for (const s of skillEntries) {
      const n = s.name.toLowerCase();
      if (n.includes('dream')) coveredDomains.add('memory_retrieval');
      if (n.includes('metacognit')) coveredDomains.add('tool_policy');
      if (n.includes('remotion') || n.includes('calc') || s.isDeNovo) coveredDomains.add('code_synthesis');
      if (n.includes('browser') || n.includes('chrome')) coveredDomains.add('browser_automation');
    }

    const allDomains: CalibrationDomain[] = [
      'code_synthesis',
      'visual_gaze',
      'system_refactor',
      'browser_automation',
      'skill_discovery',
      'tool_policy',
      'math_logic',
      'memory_retrieval',
    ];

    const uncovered = allDomains.filter(d => !coveredDomains.has(d));
    const recommendedSyntheses: string[] = [];

    if (!coveredDomains.has('visual_gaze')) {
      recommendedSyntheses.push('synthesize:visual-gaze-hierarchical-extractor');
    }
    if (!coveredDomains.has('system_refactor')) {
      recommendedSyntheses.push('synthesize:git-worktree-hygiene-manager');
    }

    const coverageRatio = (allDomains.length - uncovered.length) / allDomains.length;
    const fleetResilienceScore = Number((0.60 + coverageRatio * 0.38).toFixed(2));

    this.latestReport = {
      id: `evo-${Date.now()}`,
      totalAudited: skillEntries.length,
      healthyCount: skillEntries.filter(s => s.status === 'healthy').length,
      skills: skillEntries,
      uncoveredDomains: uncovered,
      recommendedSyntheses,
      fleetResilienceScore,
      timestamp: Date.now(),
    };

    this.saveState();
    return this.latestReport;
  }

  public getLatestReport(): EvolutionAuditReport | null {
    return this.latestReport;
  }
}

// ── Global Singleton ───────────────────────────────────────────────

let globalEvolutionEngine: CortexAgentEvolutionEngine | null = null;

export function getCortexAgentEvolution(): CortexAgentEvolutionEngine {
  if (!globalEvolutionEngine) {
    globalEvolutionEngine = new CortexAgentEvolutionEngine();
  }
  return globalEvolutionEngine;
}

