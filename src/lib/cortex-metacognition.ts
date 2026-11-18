/**
 * Cortex Metacognition Skill (cortex-metacognition.ts)
 *
 * High-level metacognitive skill that integrates calibration engine, self-assessment,
 * and epistemic vigilance into a unified introspection capability for Cortex.
 *
 * Core Capabilities:
 * 1. Self-Assessment API: Track accuracy by domain → calibration curves/ECE → flag weak areas
 * 2. Auto-Context Loading: When weak domain detected, automatically load extra context
 * 3. Confidence Calibration: Real-time dampening of overconfident predictions
 * 4. Epistemic Reporting: Generate metacognitive status reports for operator
 * 5. Skill Integration: Bridges calibration engine with nudge engine and proactive initiative
 */

import { persistentStore } from './persistent-store';
import { getCortexMetacognitionCalibration, type CalibrationDomain } from './cortex-metacognition-calibration';
import { getCortexNudgeEngine } from './cortex-nudge-engine';
import { getCortexProactiveInitiative } from './cortex-proactive-initiative';
import { getCortexEngine } from './cortex-engine';

// ── Types ──────────────────────────────────────────────────────────

export type MetacognitionAction =
  | 'get_status'
  | 'assess_domain'
  | 'record_outcome'
  | 'generate_report'
  | 'calibrate_confidence'
  | 'list_weak_domains'
  | 'get_vigilance';

export interface MetacognitionRequest {
  action: MetacognitionAction;
  domain?: string;
  predictedConfidence?: number;
  actualSuccess?: boolean;
  durationMs?: number;
  metadata?: Record<string, any>;
}

export interface MetacognitionResponse {
  success: boolean;
  data?: any;
  error?: string;
  timestamp: number;
}

export interface DomainHealthReport {
  domain: string;
  status: 'healthy' | 'monitoring' | 'critical' | 'untested';
  accuracy: number;
  ece: number;
  bias: number;
  sampleCount: number;
  recommendedVigilance: string;
  autoContextLoaded: boolean;
  contextKeys: string[];
}

export interface MetacognitionStatusReport {
  overallHealth: 'optimal' | 'degraded' | 'critical';
  overallECE: number;
  overallAccuracy: number;
  totalTrials: number;
  domainReports: DomainHealthReport[];
  weakDomains: string[];
  eliteDomains: string[];
  activeNudges: number;
  activeInitiatives: number;
  freeEnergy: number;
  resonanceScore: number;
  generatedAt: number;
}

// ── Storage ────────────────────────────────────────────────────────

const CONTEXT_CACHE_KEY = 'cortex:metacognition:context_cache:v1';
const WEAK_DOMAIN_THRESHOLD_ECE = 0.20;
const WEAK_DOMAIN_THRESHOLD_ACC = 0.70;
const CRITICAL_DOMAIN_THRESHOLD_ECE = 0.30;
const CRITICAL_DOMAIN_THRESHOLD_ACC = 0.55;

// ── Context Templates for Auto-Loading ────────────────────────────

const DOMAIN_CONTEXT_TEMPLATES: Record<string, string[]> = {
  code_synthesis: [
    'syncscript:memory:index',
    'cortex:anchor:strategy',
    'syncscript:identity:narrative',
  ],
  visual_gaze: [
    'syncscript:memory:index',
    'cortex:anchor:calibration',
  ],
  system_refactor: [
    'syncscript:memory:index',
    'cortex:anchor:strategy',
    'syncscript:identity:narrative',
  ],
  browser_automation: [
    'syncscript:memory:index',
  ],
  skill_discovery: [
    'syncscript:memory:index',
    'cortex:anchor:strategy',
  ],
  tool_policy: [
    'cortex:anchor:calibration',
    'syncscript:identity:narrative',
  ],
  math_logic: [
    'syncscript:memory:index',
  ],
  memory_retrieval: [
    'syncscript:memory:index',
    'cortex:anchor:narrative',
    'cortex:anchor:strategy',
    'cortex:anchor:calibration',
  ],
  general: [
    'syncscript:memory:index',
  ],
};

// ── Metacognition Skill ────────────────────────────────────────────

export class CortexMetacognitionSkill {
  private contextCache: Map<string, string> = new Map();

  constructor() {
    this.loadContextCache();
  }

  private loadContextCache(): void {
    try {
      const raw = persistentStore.getItem(CONTEXT_CACHE_KEY);
      if (raw) {
        const obj = JSON.parse(raw);
        this.contextCache = new Map(Object.entries(obj));
      }
    } catch {
      // Ignore
    }
  }

  private saveContextCache(): void {
    try {
      persistentStore.setItem(CONTEXT_CACHE_KEY, JSON.stringify(Object.fromEntries(this.contextCache)));
    } catch {
      // Ignore
    }
  }

  /**
   * Main entry point for metacognition actions.
   */
  public async handleRequest(request: MetacognitionRequest): Promise<MetacognitionResponse> {
    try {
      switch (request.action) {
        case 'get_status':
          return { success: true, data: await this.getStatusReport(), timestamp: Date.now() };
        case 'assess_domain':
          return { success: true, data: await this.assessDomain(request.domain || 'general', request.predictedConfidence || 0.8), timestamp: Date.now() };
        case 'record_outcome':
          return { success: true, data: this.recordOutcome(request.domain || 'general', request.predictedConfidence || 0.8, request.actualSuccess || false, request.durationMs || 0, request.metadata), timestamp: Date.now() };
        case 'generate_report':
          return { success: true, data: await this.generateFullReport(), timestamp: Date.now() };
        case 'calibrate_confidence':
          return { success: true, data: this.calibrateConfidence(request.domain || 'general', request.predictedConfidence || 0.8), timestamp: Date.now() };
        case 'list_weak_domains':
          return { success: true, data: this.listWeakDomains(), timestamp: Date.now() };
        case 'get_vigilance':
          return { success: true, data: this.getVigilance(request.domain || 'general', request.predictedConfidence || 0.8), timestamp: Date.now() };
        default:
          return { success: false, error: `Unknown action: ${request.action}`, timestamp: Date.now() };
      }
    } catch (error: any) {
      return { success: false, error: error.message, timestamp: Date.now() };
    }
  }

  /**
   * Gets comprehensive metacognitive status report.
   */
  public async getStatusReport(): Promise<MetacognitionStatusReport> {
    const calEngine = getCortexMetacognitionCalibration();
    const nudgeEngine = getCortexNudgeEngine();
    const initiative = getCortexProactiveInitiative();

    const snapshot = calEngine.getSnapshot();
    const nudges = nudgeEngine.getHistory?.() || [];
    const proposals = initiative.getActiveProposals();

    const domainReports: DomainHealthReport[] = [];
    const allDomains = [
      'code_synthesis', 'visual_gaze', 'system_refactor', 'browser_automation',
      'skill_discovery', 'tool_policy', 'math_logic', 'memory_retrieval', 'general'
    ];

    for (const domain of allDomains) {
      const metrics = snapshot.domains[domain as CalibrationDomain];
      const autoContextLoaded = this.contextCache.has(domain);
      let status: DomainHealthReport['status'] = 'untested';

      if (metrics.sampleCount >= 3) {
        if (metrics.expectedCalibrationError > CRITICAL_DOMAIN_THRESHOLD_ECE || metrics.empiricalAccuracy < CRITICAL_DOMAIN_THRESHOLD_ACC) {
          status = 'critical';
        } else if (metrics.expectedCalibrationError > WEAK_DOMAIN_THRESHOLD_ECE || metrics.empiricalAccuracy < WEAK_DOMAIN_THRESHOLD_ACC) {
          status = 'monitoring';
        } else {
          status = 'healthy';
        }
      }

      domainReports.push({
        domain,
        status,
        accuracy: metrics.empiricalAccuracy,
        ece: metrics.expectedCalibrationError,
        bias: metrics.overconfidenceBias,
        sampleCount: metrics.sampleCount,
        recommendedVigilance: metrics.recommendedVigilance,
        autoContextLoaded,
        contextKeys: DOMAIN_CONTEXT_TEMPLATES[domain] || [],
      });
    }

    let overallHealth: MetacognitionStatusReport['overallHealth'] = 'optimal';
    const criticalCount = domainReports.filter(d => d.status === 'critical').length;
    const monitoringCount = domainReports.filter(d => d.status === 'monitoring').length;

    if (criticalCount > 0) overallHealth = 'critical';
    else if (monitoringCount > 2) overallHealth = 'degraded';

    return {
      overallHealth,
      overallECE: snapshot.overallECE,
      overallAccuracy: snapshot.overallAccuracy,
      totalTrials: snapshot.totalTrials,
      domainReports,
      weakDomains: snapshot.weakDomains,
      eliteDomains: snapshot.eliteDomains,
      activeNudges: nudges.filter((n: any) => !n.dismissed && !n.actionTaken).length,
      activeInitiatives: proposals.filter(p => !p.dismissed).length,
      freeEnergy: snapshot.overallECE + (1 - snapshot.overallAccuracy) * 0.5,
      resonanceScore: snapshot.overallAccuracy > 0.85 ? 0.92 : 0.78,
      generatedAt: Date.now(),
    };
  }

  /**
   * Assesses a specific domain, auto-loads context if weak.
   */
  public async assessDomain(domain: string, predictedConfidence: number): Promise<DomainHealthReport & { calibratedConfidence: number; contextLoaded: string[] }> {
    const calEngine = getCortexMetacognitionCalibration();
    const metrics = calEngine.getDomainMetrics(domain as any);
    const vigilance = calEngine.assessDomainVigilance(domain as any, predictedConfidence);

    let contextLoaded: string[] = [];
    const isWeak = metrics.expectedCalibrationError > WEAK_DOMAIN_THRESHOLD_ECE || metrics.empiricalAccuracy < WEAK_DOMAIN_THRESHOLD_ACC;

    if (isWeak && !this.contextCache.has(domain)) {
      contextLoaded = await this.autoLoadContext(domain);
    }

    let status: DomainHealthReport['status'] = 'untested';
    if (metrics.sampleCount >= 3) {
      if (metrics.expectedCalibrationError > CRITICAL_DOMAIN_THRESHOLD_ECE || metrics.empiricalAccuracy < CRITICAL_DOMAIN_THRESHOLD_ACC) {
        status = 'critical';
      } else if (metrics.expectedCalibrationError > WEAK_DOMAIN_THRESHOLD_ECE || metrics.empiricalAccuracy < WEAK_DOMAIN_THRESHOLD_ACC) {
        status = 'monitoring';
      } else {
        status = 'healthy';
      }
    }

    return {
      domain,
      status,
      accuracy: metrics.empiricalAccuracy,
      ece: metrics.expectedCalibrationError,
      bias: metrics.overconfidenceBias,
      sampleCount: metrics.sampleCount,
      recommendedVigilance: metrics.recommendedVigilance,
      autoContextLoaded: this.contextCache.has(domain),
      contextKeys: DOMAIN_CONTEXT_TEMPLATES[domain] || [],
      calibratedConfidence: vigilance.calibratedConfidence,
      contextLoaded,
    };
  }

  /**
   * Auto-loads extra context for weak domain.
   */
  private async autoLoadContext(domain: string): Promise<string[]> {
    const keys = DOMAIN_CONTEXT_TEMPLATES[domain] || DOMAIN_CONTEXT_TEMPLATES.general;
    const loaded: string[] = [];

    for (const key of keys) {
      try {
        const value = persistentStore.getItem(key);
        if (value) {
          this.contextCache.set(`${domain}:${key}`, value);
          loaded.push(key);
        }
      } catch {
        // Ignore
      }
    }

    if (loaded.length > 0) {
      this.saveContextCache();
      console.info(`[Metacognition] Auto-loaded context for weak domain "${domain}": ${loaded.join(', ')}`);
    }

    return loaded;
  }

  /**
   * Records a trial outcome in the calibration engine.
   */
  public recordOutcome(
    domain: string,
    predictedConfidence: number,
    actualSuccess: boolean,
    durationMs: number,
    metadata?: Record<string, any>
  ): any {
    const calEngine = getCortexMetacognitionCalibration();
    const trial = calEngine.recordTrial({
      domain: domain as any,
      predictedConfidence,
      actualSuccess,
      durationMs,
      metadata,
    });

    // Trigger nudge if calibration drift detected
    const metrics = calEngine.getDomainMetrics(domain as any);
    if (metrics.sampleCount >= 5 && metrics.expectedCalibrationError > 0.25) {
      const nudgeEngine = getCortexNudgeEngine();
      nudgeEngine.emitNudge?.({
        type: 'calibration_drift',
        title: `Calibration Drift: ${domain}`,
        message: `Domain "${domain}" ECE=${metrics.expectedCalibrationError.toFixed(3)} exceeds threshold. Consider recalibration.`,
        urgency: 'medium',
        source: 'metacognition',
        actionLabel: 'Run Calibration',
        actionTool: 'cortex_metacognition',
        actionArgs: { action: 'assess_domain', domain },
      });
    }

    return trial;
  }

  /**
   * Generates a full metacognitive report for the operator.
   */
  public async generateFullReport(): Promise<string> {
    const status = await this.getStatusReport();
    const calEngine = getCortexMetacognitionCalibration();
    const snapshot = calEngine.getSnapshot();

    const lines = [
      '# Cortex Metacognitive Status Report',
      `**Generated:** ${new Date(status.generatedAt).toISOString()}`,
      `**Overall Health:** ${status.overallHealth.toUpperCase()}`,
      `**Overall ECE:** ${status.overallECE.toFixed(3)}`,
      `**Overall Accuracy:** ${(status.overallAccuracy * 100).toFixed(1)}%`,
      `**Total Trials:** ${status.totalTrials}`,
      `**Free Energy:** ${status.freeEnergy.toFixed(3)}`,
      `**Resonance Score:** ${status.resonanceScore.toFixed(2)}`,
      '',
      '## Domain Breakdown',
      '',
    ];

    for (const d of status.domainReports) {
      const indicator = d.status === 'healthy' ? '✅' : d.status === 'monitoring' ? '⚠️' : d.status === 'critical' ? '🔴' : '❓';
      lines.push(`${indicator} **${d.domain}** (${d.status})`);
      lines.push(`  - Accuracy: ${(d.accuracy * 100).toFixed(1)}% | ECE: ${d.ece.toFixed(3)} | Bias: ${d.bias > 0 ? '+' : ''}${d.bias.toFixed(3)}`);
      lines.push(`  - Trials: ${d.sampleCount} | Vigilance: ${d.recommendedVigilance}`);
      if (d.autoContextLoaded) {
        lines.push(`  - 📦 Auto-context loaded: ${d.contextKeys.join(', ')}`);
      }
      lines.push('');
    }

    if (status.weakDomains.length > 0) {
      lines.push('## ⚠️ Weak Domains Requiring Attention');
      for (const d of status.weakDomains) {
        const m = snapshot.domains[d as CalibrationDomain];
        lines.push(`- **${d}**: Acc=${(m.empiricalAccuracy * 100).toFixed(1)}%, ECE=${m.expectedCalibrationError.toFixed(3)}, Vigilance=${m.recommendedVigilance}`);
      }
      lines.push('');
    }

    if (status.eliteDomains.length > 0) {
      lines.push('## ✅ Elite Reliability Domains');
      for (const d of status.eliteDomains) {
        lines.push(`- ${d}`);
      }
      lines.push('');
    }

    lines.push('## Active Signals');
    lines.push(`- Active Nudges: ${status.activeNudges}`);
    lines.push(`- Active Initiatives: ${status.activeInitiatives}`);
    lines.push('');

    lines.push('---');
    lines.push('*Report generated by Cortex Metacognition Skill*');

    return lines.join('\n');
  }

  /**
   * Calibrates a raw confidence score for a domain.
   */
  public calibrateConfidence(domain: string, rawConfidence: number): { raw: number; calibrated: number; dampening: number; vigilance: string; requiresDryRun: boolean } {
    const calEngine = getCortexMetacognitionCalibration();
    const vigilance = calEngine.assessDomainVigilance(domain as any, rawConfidence);

    return {
      raw: vigilance.rawConfidence,
      calibrated: vigilance.calibratedConfidence,
      dampening: vigilance.overconfidenceDampening,
      vigilance: vigilance.recommendedVigilance,
      requiresDryRun: vigilance.requiresDryRun,
    };
  }

  /**
   * Lists all weak domains.
   */
  public listWeakDomains(): Array<{ domain: string; ece: number; accuracy: number; vigilance: string }> {
    const calEngine = getCortexMetacognitionCalibration();
    const snapshot = calEngine.getSnapshot();

    return snapshot.weakDomains.map(domain => {
      const m = snapshot.domains[domain as CalibrationDomain];
      return {
        domain,
        ece: m.expectedCalibrationError,
        accuracy: m.empiricalAccuracy,
        vigilance: m.recommendedVigilance,
      };
    });
  }

  /**
   * Gets vigilance assessment for a domain/confidence pair.
   */
  public getVigilance(domain: string, rawConfidence: number): any {
    const calEngine = getCortexMetacognitionCalibration();
    return calEngine.assessDomainVigilance(domain as any, rawConfidence);
  }

  /**
   * Clears context cache (for testing or reset).
   */
  public clearContextCache(): void {
    this.contextCache.clear();
    this.saveContextCache();
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalMetacognitionSkill: CortexMetacognitionSkill | null = null;

export function getCortexMetacognition(): CortexMetacognitionSkill {
  if (!globalMetacognitionSkill) {
    globalMetacognitionSkill = new CortexMetacognitionSkill();
  }
  return globalMetacognitionSkill;
}

export function resetCortexMetacognition(): void {
  if (globalMetacognitionSkill) {
    globalMetacognitionSkill.clearContextCache();
    globalMetacognitionSkill = null;
  }
}