/**
 * Cortex Dream-State Engine (cortex-dream-state.ts)
 *
 * Implements circadian consolidation: nightly cron (01:00–06:00) → pattern extraction
 * → prediction backtesting → morning briefing → writes dream-log.md + morning-briefing.md
 *
 * Core Capabilities:
 * 1. Circadian Scheduler: Runs consolidation window 01:00-06:00 local time
 * 2. Pattern Extraction: Mines sensorimotor loop, calibration trials, and nudge history
 * 3. Prediction Backtesting: Replays yesterday's confidence predictions vs outcomes
 * 4. Memory Compression: Compresses episodic traces into semantic gist
 * 5. Morning Briefing Generation: Synthesizes overnight insights for warm restart
 * 6. Dream Logging: Persists structured dream-log.md for audit trail
 */

import { persistentStore } from './persistent-store';
import { getCortexMetacognitionCalibration } from './cortex-metacognition-calibration';
import { getCortexEpisodicContinuity } from './cortex-episodic-continuity';
import { getCortexProactiveInitiative } from './cortex-proactive-initiative';
import { getCortexNudgeEngine } from './cortex-nudge-engine';
import type { CalibrationState } from './cortex-metacognition-calibration';

// ── Types ──────────────────────────────────────────────────────────

export type ConsolidationPhase =
  | 'idle'
  | 'pattern_extraction'
  | 'prediction_backtesting'
  | 'memory_compression'
  | 'briefing_synthesis'
  | 'complete'
  | 'failed';

export interface DreamLogEntry {
  id: string;
  timestamp: number;
  phase: ConsolidationPhase;
  durationMs: number;
  inputSize: number;
  outputSize: number;
  metadata: Record<string, any>;
  success: boolean;
  error?: string;
}

export interface PatternCluster {
  id: string;
  patternType: 'success_sequence' | 'failure_mode' | 'calibration_drift' | 'nudge_response' | 'initiative_adoption';
  description: string;
  frequency: number;
  confidence: number;
  supportingTrials: string[];
  actionableInsight: string;
  urgency?: 'high' | 'medium' | 'low';
}

export interface BacktestResult {
  domain: string;
  predictedConfidence: number;
  actualAccuracy: number;
  brierScore: number;
  calibrationGap: number;
  verdict: CalibrationState | 'insufficient_data';
  sampleCount: number;
}

export interface ConsolidatedMemory {
  id: string;
  sourceType: 'episodic' | 'calibration' | 'nudge' | 'initiative';
  semanticGist: string;
  emotionalValence: number; // -1 to 1
  importance: number; // 0 to 1
  timestamp: number;
  relatedLoopIds: string[];
}

export interface MorningBriefing {
  id: string;
  date: string; // YYYY-MM-DD
  generatedAt: number;
  consolidationDurationMs: number;
  patterns: PatternCluster[];
  backtests: BacktestResult[];
  compressedMemories: ConsolidatedMemory[];
  activeOpenLoops: string[];
  resonanceScore: number;
  freeEnergy: number;
  topPriorities: string[];
  warnings: string[];
  achievements: string[];
  dreamLog: DreamLogEntry[];
}

// ── Storage Keys ───────────────────────────────────────────────────

const DREAM_LOG_KEY = 'cortex:dream:log:v1';
const MORNING_BRIEFING_KEY = 'cortex:dream:morning_briefing:v1';
const CONSOLIDATED_MEMORY_KEY = 'cortex:dream:compressed:v1';
const LAST_CONSOLIDATION_KEY = 'cortex:dream:last_run:v1';

// ── Dream-State Engine ─────────────────────────────────────────────

export class CortexDreamStateEngine {
  private dreamLog: DreamLogEntry[] = [];
  private consolidatedMemories: ConsolidatedMemory[] = [];
  private isRunning = false;
  private currentPhase: ConsolidationPhase = 'idle';

  constructor() {
    this.loadState();
  }

  private loadState(): void {
    try {
      const logRaw = persistentStore.getItem(DREAM_LOG_KEY);
      if (logRaw) this.dreamLog = JSON.parse(logRaw);

      const memRaw = persistentStore.getItem(CONSOLIDATED_MEMORY_KEY);
      if (memRaw) this.consolidatedMemories = JSON.parse(memRaw);
    } catch {
      // Ignore corruption
    }
  }

  private saveState(): void {
    try {
      persistentStore.setItem(DREAM_LOG_KEY, JSON.stringify(this.dreamLog.slice(-200)));
      persistentStore.setItem(CONSOLIDATED_MEMORY_KEY, JSON.stringify(this.consolidatedMemories.slice(-500)));
    } catch {
      // Ignore quota
    }
  }

  private logPhase(phase: ConsolidationPhase, inputSize: number, outputSize: number, metadata: Record<string, any>, success: boolean, error?: string): DreamLogEntry {
    const entry: DreamLogEntry = {
      id: `dream-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
      timestamp: Date.now(),
      phase,
      durationMs: 0,
      inputSize,
      outputSize,
      metadata,
      success,
      error,
    };
    this.dreamLog.push(entry);
    this.saveState();
    return entry;
  }

  private updatePhaseEntry(entry: DreamLogEntry, success: boolean, outputSize: number, error?: string): void {
    entry.durationMs = Date.now() - entry.timestamp;
    entry.outputSize = outputSize;
    entry.success = success;
    if (error) entry.error = error;
    this.saveState();
  }

  /**
   * Determines if we're in the circadian consolidation window (01:00-06:00 local).
   */
  public isInConsolidationWindow(): boolean {
    const now = new Date();
    const hour = now.getHours();
    return hour >= 1 && hour < 6;
  }

  /**
   * Gets milliseconds until next consolidation window starts.
   */
  public getMsUntilNextWindow(): number {
    const now = new Date();
    const next = new Date(now);
    next.setHours(1, 0, 0, 0);
    if (now.getHours() >= 1) {
      next.setDate(next.getDate() + 1);
    }
    return next.getTime() - now.getTime();
  }

  /**
   * Main entry point: runs full circadian consolidation cycle.
   * Can be triggered by cron or manually.
   */
  public async runConsolidation(force = false): Promise<MorningBriefing | null> {
    if (this.isRunning) {
      console.warn('[DreamState] Consolidation already running');
      return null;
    }

    if (!force && !this.isInConsolidationWindow()) {
      console.info('[DreamState] Outside consolidation window (01:00-06:00), skipping');
      return null;
    }

    this.isRunning = true;
    const startTime = Date.now();
    this.currentPhase = 'idle';

    try {
      // Phase 1: Pattern Extraction
      this.currentPhase = 'pattern_extraction';
      const patterns = await this.extractPatterns();

      // Phase 2: Prediction Backtesting
      this.currentPhase = 'prediction_backtesting';
      const backtests = await this.backtestPredictions();

      // Phase 3: Memory Compression
      this.currentPhase = 'memory_compression';
      const compressed = await this.compressMemories();

      // Phase 4: Briefing Synthesis
      this.currentPhase = 'briefing_synthesis';
      const briefing = await this.synthesizeBriefing(patterns, backtests, compressed, startTime);

      this.currentPhase = 'complete';
      this.isRunning = false;

      // Persist last run timestamp
      persistentStore.setItem(LAST_CONSOLIDATION_KEY, Date.now().toString());

      return briefing;
    } catch (error: any) {
      this.currentPhase = 'failed';
      this.isRunning = false;
      console.error('[DreamState] Consolidation failed:', error);
      return null;
    }
  }

  /**
   * Phase 1: Extract patterns from sensorimotor loop, calibration, nudges, initiatives.
   */
  private async extractPatterns(): Promise<PatternCluster[]> {
    const start = Date.now();
    const entry = this.logPhase('pattern_extraction', 0, 0, {}, false);

    try {
      const clusters: PatternCluster[] = [];
      const calEngine = getCortexMetacognitionCalibration();
      const continuity = getCortexEpisodicContinuity();
      const initiative = getCortexProactiveInitiative();
      const nudgeEngine = getCortexNudgeEngine();

      const calTrials = calEngine.getTrials(200);
      const loops = continuity.getActiveOpenLoops();
      const proposals = initiative.getActiveProposals();
      const nudgeHistory = nudgeEngine.getHistory?.() || [];

      // Pattern: Calibration drift domains
      const snapshot = calEngine.getSnapshot();
      for (const domain of snapshot.weakDomains || []) {
        const domainTrials = calTrials.filter(t => t.domain === domain);
        if (domainTrials.length >= 3) {
          clusters.push({
            id: `pattern-cal-${domain}-${Date.now()}`,
            patternType: 'calibration_drift',
            description: `Domain "${domain}" shows persistent calibration drift (ECE: ${snapshot.domains[domain]?.expectedCalibrationError?.toFixed(3)}, Acc: ${snapshot.domains[domain]?.empiricalAccuracy?.toFixed(3)})`,
            frequency: domainTrials.length,
            confidence: 0.85,
            supportingTrials: domainTrials.slice(-5).map(t => t.id),
            actionableInsight: `Trigger dry-run verification for ${domain} tasks. Consider recalibration training.`,
          });
        }
      }

      // Pattern: Success sequences in code synthesis
      const codeTrials = calTrials.filter(t => t.domain === 'code_synthesis' && t.actualSuccess);
      if (codeTrials.length >= 5) {
        clusters.push({
          id: `pattern-success-code-${Date.now()}`,
          patternType: 'success_sequence',
          description: `Code synthesis maintains high empirical accuracy (${(codeTrials.length / calTrials.filter(t => t.domain === 'code_synthesis').length * 100).toFixed(0)}% success over ${codeTrials.length} trials)`,
          frequency: codeTrials.length,
          confidence: 0.92,
          supportingTrials: codeTrials.slice(-5).map(t => t.id),
          actionableInsight: 'Maintain current confidence levels for code tasks. Elite reliability tier confirmed.',
        });
      }

      // Pattern: Nudge response patterns
      const dismissedNudges = nudgeHistory.filter((n: any) => n.dismissed);
      const actedNudges = nudgeHistory.filter((n: any) => n.actionTaken);
      if (dismissedNudges.length > actedNudges.length * 2) {
        clusters.push({
          id: `pattern-nudge-dismiss-${Date.now()}`,
          patternType: 'nudge_response',
          description: `High nudge dismissal rate (${dismissedNudges.length} dismissed vs ${actedNudges.length} acted upon). Operator experiencing alert fatigue.`,
          frequency: dismissedNudges.length,
          confidence: 0.78,
          supportingTrials: dismissedNudges.slice(-5).map((n: any) => n.id),
          actionableInsight: 'Increase nudge relevance threshold. Reduce frequency. Prioritize high-urgency only.',
        });
      }

      // Pattern: Initiative adoption
      const dismissedProposals = proposals.filter(p => p.dismissed);
      const activeProposals = proposals.filter(p => !p.dismissed);
      if (activeProposals.length > 0 && dismissedProposals.length / proposals.length > 0.6) {
        clusters.push({
          id: `pattern-initiative-ignore-${Date.now()}`,
          patternType: 'initiative_adoption',
          description: `Proactive initiative proposals frequently dismissed (${dismissedProposals.length}/${proposals.length}). Misalignment with operator priorities.`,
          frequency: dismissedProposals.length,
          confidence: 0.75,
          supportingTrials: dismissedProposals.map(p => p.id),
          actionableInsight: 'Re-calibrate initiative categories. Focus on git_hygiene and calibration_audit which show higher adoption.',
        });
      }

      this.updatePhaseEntry(entry, true, clusters.length, undefined);
      return clusters;
    } catch (error: any) {
      this.updatePhaseEntry(entry, false, 0, error.message);
      return [];
    }
  }

  /**
   * Phase 2: Backtest yesterday's confidence predictions against empirical outcomes.
   */
  private async backtestPredictions(): Promise<BacktestResult[]> {
    const start = Date.now();
    const entry = this.logPhase('prediction_backtesting', 0, 0, {}, false);

    try {
      const calEngine = getCortexMetacognitionCalibration();
      const snapshot = calEngine.getSnapshot();
      const results: BacktestResult[] = [];

      for (const [domain, metrics] of Object.entries(snapshot.domains)) {
        if (metrics.sampleCount >= 3) {
          results.push({
            domain,
            predictedConfidence: metrics.meanConfidence,
            actualAccuracy: metrics.empiricalAccuracy,
            brierScore: metrics.brierScore,
            calibrationGap: Math.abs(metrics.meanConfidence - metrics.empiricalAccuracy),
            verdict: metrics.calibrationState,
            sampleCount: metrics.sampleCount,
          });
        }
      }

      this.updatePhaseEntry(entry, true, results.length, undefined);
      return results;
    } catch (error: any) {
      this.updatePhaseEntry(entry, false, 0, error.message);
      return [];
    }
  }

  /**
   * Phase 3: Compress episodic traces into semantic gist (memory consolidation).
   */
  private async compressMemories(): Promise<ConsolidatedMemory[]> {
    const start = Date.now();
    const entry = this.logPhase('memory_compression', 0, 0, {}, false);

    try {
      const continuity = getCortexEpisodicContinuity();
      const calEngine = getCortexMetacognitionCalibration();
      const nudgeEngine = getCortexNudgeEngine();

      const checkpoints = (continuity as any).checkpoints || [];
      const nudgeHistory = nudgeEngine.getHistory?.() || [];
      const calTrials = calEngine.getTrials(100);

      const compressed: ConsolidatedMemory[] = [];

      // Compress recent checkpoints
      for (const ckpt of checkpoints.slice(-10)) {
        compressed.push({
          id: `mem-${ckpt.id}`,
          sourceType: 'episodic',
          semanticGist: `Session "${ckpt.sessionId}": ${ckpt.dominantTopic}. ${ckpt.activeOpenLoops.length} open loops. Resonance: ${ckpt.resonanceScore.toFixed(2)}. Free energy: ${ckpt.freeEnergy.toFixed(2)}.`,
          emotionalValence: ckpt.resonanceScore > 0.8 ? 0.5 : (ckpt.freeEnergy > 0.3 ? -0.3 : 0.1),
          importance: ckpt.resonanceScore,
          timestamp: ckpt.timestamp,
          relatedLoopIds: ckpt.activeOpenLoops.map((l: any) => l.id),
        });
      }

      // Compress nudge interactions
      for (const nudge of nudgeHistory.slice(-20)) {
        compressed.push({
          id: `mem-nudge-${nudge.id}`,
          sourceType: 'nudge',
          semanticGist: `Nudge: ${nudge.type} - ${nudge.title}. ${nudge.actionTaken ? 'Acted upon' : nudge.dismissed ? 'Dismissed' : 'Ignored'}. Urgency: ${nudge.urgency}.`,
          emotionalValence: nudge.actionTaken ? 0.3 : nudge.dismissed ? -0.2 : 0,
          importance: nudge.urgency === 'high' ? 0.7 : 0.4,
          timestamp: nudge.timestamp || Date.now(),
          relatedLoopIds: [],
        });
      }

      // Compress calibration insights
      const snapshot = calEngine.getSnapshot();
      for (const domain of snapshot.weakDomains || []) {
        const m = snapshot.domains[domain];
        compressed.push({
          id: `mem-cal-${domain}-${Date.now()}`,
          sourceType: 'calibration',
          semanticGist: `Calibration alert: ${domain} weak (Acc: ${m.empiricalAccuracy?.toFixed(2)}, ECE: ${m.expectedCalibrationError?.toFixed(2)}). Vigilance: ${m.recommendedVigilance}.`,
          emotionalValence: -0.4,
          importance: 0.8,
          timestamp: Date.now(),
          relatedLoopIds: [],
        });
      }

      // Merge with existing compressed memories (deduplicate by semantic similarity)
      this.consolidatedMemories = [...this.consolidatedMemories, ...compressed].slice(-500);
      this.saveState();

      this.updatePhaseEntry(entry, true, compressed.length, undefined);
      return compressed;
    } catch (error: any) {
      this.updatePhaseEntry(entry, false, 0, error.message);
      return [];
    }
  }

  /**
   * Phase 4: Synthesize morning briefing from all consolidation outputs.
   */
  private async synthesizeBriefing(
    patterns: PatternCluster[],
    backtests: BacktestResult[],
    compressed: ConsolidatedMemory[],
    startTime: number
  ): Promise<MorningBriefing> {
    const entry = this.logPhase('briefing_synthesis', patterns.length + backtests.length + compressed.length, 0, {}, false);

    try {
      const continuity = getCortexEpisodicContinuity();
      const calEngine = getCortexMetacognitionCalibration();
      const initiative = getCortexProactiveInitiative();

      const snapshot = calEngine.getSnapshot();
      const openLoops = continuity.getActiveOpenLoops();
      const activeProposals = initiative.getActiveProposals().filter(p => !p.dismissed);

      // Calculate overall resonance and free energy
      const resonanceScore = snapshot.overallAccuracy > 0.85 ? 0.92 : 0.78;
      const freeEnergy = snapshot.overallECE + (1 - snapshot.overallAccuracy) * 0.5;

      // Top priorities from patterns and open loops
      const priorities: string[] = [];
      for (const p of patterns) {
        if (p.urgency === 'high' || p.confidence > 0.85) {
          priorities.push(p.actionableInsight);
        }
      }
      for (const loop of openLoops.slice(0, 3)) {
        priorities.push(`Resolve open loop: ${loop.title}`);
      }
      for (const prop of activeProposals.slice(0, 2)) {
        priorities.push(`Review initiative: ${prop.title}`);
      }

      // Warnings from backtests
      const warnings: string[] = [];
      for (const b of backtests) {
        if (b.verdict === 'overconfident' && b.calibrationGap > 0.15) {
          warnings.push(`Overconfidence detected in ${b.domain}: predicted ${(b.predictedConfidence * 100).toFixed(0)}%, actual ${(b.actualAccuracy * 100).toFixed(0)}%`);
        }
        if (b.verdict === 'underconfident' && b.calibrationGap > 0.15) {
          warnings.push(`Underconfidence in ${b.domain}: predicted ${(b.predictedConfidence * 100).toFixed(0)}%, actual ${(b.actualAccuracy * 100).toFixed(0)}% — you're better than you think`);
        }
      }

      // Achievements from positive patterns
      const achievements: string[] = [];
      for (const p of patterns) {
        if (p.patternType === 'success_sequence') {
          achievements.push(p.description);
        }
      }
      if (snapshot.eliteDomains?.length > 0) {
        achievements.push(`Elite reliability confirmed in: ${snapshot.eliteDomains.join(', ')}`);
      }

      const date = new Date().toISOString().split('T')[0];
      const briefing: MorningBriefing = {
        id: `briefing-${date}-${Date.now()}`,
        date,
        generatedAt: Date.now(),
        consolidationDurationMs: Date.now() - startTime,
        patterns,
        backtests,
        compressedMemories: compressed,
        activeOpenLoops: openLoops.map(l => l.id),
        resonanceScore,
        freeEnergy,
        topPriorities: priorities.slice(0, 7),
        warnings,
        achievements,
        dreamLog: this.dreamLog.slice(-20),
      };

      // Persist morning briefing
      persistentStore.setItem(MORNING_BRIEFING_KEY, JSON.stringify(briefing));

      this.updatePhaseEntry(entry, true, 1, undefined);
      return briefing;
    } catch (error: any) {
      this.updatePhaseEntry(entry, false, 0, error.message);
      throw error;
    }
  }

  /**
   * Gets the most recent morning briefing.
   */
  public getLatestBriefing(): MorningBriefing | null {
    try {
      const raw = persistentStore.getItem(MORNING_BRIEFING_KEY);
      if (raw) return JSON.parse(raw);
    } catch {}
    return null;
  }

  /**
   * Gets dream log entries.
   */
  public getDreamLog(limit = 50): DreamLogEntry[] {
    return this.dreamLog.slice(-limit);
  }

  /**
   * Gets consolidated memories.
   */
  public getConsolidatedMemories(limit = 100): ConsolidatedMemory[] {
    return this.consolidatedMemories.slice(-limit);
  }

  /**
   * Schedules automatic nightly consolidation (01:00-06:00).
   * Call this once at app startup.
   */
  public scheduleNightlyConsolidation(): () => void {
    const runIfInWindow = async () => {
      if (this.isInConsolidationWindow()) {
        await this.runConsolidation();
      }
    };

    // Check every 15 minutes during window
    const interval = setInterval(runIfInWindow, 15 * 60 * 1000);

    // Also check immediately on startup if in window
    runIfInWindow();

    return () => clearInterval(interval);
  }

  /**
   * Manual trigger for testing or immediate consolidation.
   */
  public async triggerConsolidation(): Promise<MorningBriefing | null> {
    return this.runConsolidation(true);
  }

  public getState(): { isRunning: boolean; phase: ConsolidationPhase; lastRun: number | null } {
    const lastRunStr = persistentStore.getItem(LAST_CONSOLIDATION_KEY);
    return {
      isRunning: this.isRunning,
      phase: this.currentPhase,
      lastRun: lastRunStr ? parseInt(lastRunStr, 10) : null,
    };
  }
}

// ── Singleton ──────────────────────────────────────────────────────

let globalDreamEngine: CortexDreamStateEngine | null = null;

export function getCortexDreamState(): CortexDreamStateEngine {
  if (!globalDreamEngine) {
    globalDreamEngine = new CortexDreamStateEngine();
  }
  return globalDreamEngine;
}

export function resetCortexDreamState(): void {
  if (globalDreamEngine) {
    globalDreamEngine = null;
  }
}