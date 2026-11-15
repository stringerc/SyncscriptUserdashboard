/**
 * Identity Spine — Rank A Memory & Session Continuity Layer
 *
 * Implements Phase 3 of the Operational Mind mission (OPERATIONAL_MIND_OPENCLAW_HERMES_MISSION.md).
 * Loads, validates, and maintains agent operational identity directly from Rank A sources of truth:
 *
 * 1. MEMORY.md: Hot layer (lines 1-96, quick context panel, cross-cutting landmines).
 * 2. SESSION_START.md: Session handoff, current product priorities, work discipline, and measured gate lines.
 *
 * Grounded in the Locke/Parfit continuity tradition: identity does not depend on a single ephemeral chat context,
 * but on overlapping chains of psychological connectedness and durable, verifiable episodic records.
 *
 * Honest Canon Boundary:
 * Goal B (operational agent, gated tools, audited identity) is achieved.
 * Goal C (phenomenal consciousness) is undecidable in non-biological architectures (Neuron 2026).
 */

import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export interface RankABullet {
  category: 'memory-hot' | 'session-focus' | 'session-priority' | 'session-discipline' | 'cortex-gate' | 'epistemic-gate';
  content: string;
  source: 'MEMORY.md' | 'SESSION_START.md';
  key?: string;
}

export interface CortexGateReport {
  timestamp: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  cortex70Score: string;
  coverageAvg: number;
  components: {
    gwt: number;
    ast: number;
    pp: number;
    rpt: number;
    hot: number;
    iit: number;
  };
  gitSha: string;
  raw: string;
}

export interface EpistemicGateReport {
  timestamp: string;
  status: 'PASS' | 'FAIL' | 'UNKNOWN';
  f: number;
  h: number;
  grade: string;
  claimsCount: string;
  gitSha: string;
  raw: string;
}

export interface SessionState {
  currentFocus: string;
  productPriority: string;
  howWeWork: string[];
  ideDiscipline: string[];
  lastSessionHighlights: string[];
  lastCortexGate: CortexGateReport | null;
  lastEpistemicGate: EpistemicGateReport | null;
}

export interface OperationalIdentity {
  agentName: string;
  framework: string;
  truthBoundary: string;
  loadedAt: number;
  memoryPath: string;
  sessionStartPath: string;
  rankABullets: RankABullet[];
  sessionState: SessionState;
  hotLayerText: string;
  integrityHash: string;
}

export interface IdentitySpineOptions {
  memoryPath?: string;
  sessionStartPath?: string;
  memoryContent?: string;
  sessionStartContent?: string;
  autoLoad?: boolean;
}

export class IdentitySpine {
  private memoryPath: string;
  private sessionStartPath: string;
  private identity: OperationalIdentity | null = null;
  private loaded = false;

  constructor(options: IdentitySpineOptions = {}) {
    this.memoryPath = options.memoryPath ?? join(process.cwd(), 'MEMORY.md');
    this.sessionStartPath = options.sessionStartPath ?? join(process.cwd(), 'SESSION_START.md');

    if (options.autoLoad !== false) {
      this.loadRankA({
        memoryPath: this.memoryPath,
        sessionStartPath: this.sessionStartPath,
        memoryContent: options.memoryContent,
        sessionStartContent: options.sessionStartContent,
      });
    }
  }

  /**
   * Load and parse Rank A bullets from MEMORY.md and SESSION_START.md
   */
  public loadRankA(options: IdentitySpineOptions = {}): OperationalIdentity {
    const memPath = options.memoryPath ?? this.memoryPath;
    const sessPath = options.sessionStartPath ?? this.sessionStartPath;

    let memContent = options.memoryContent ?? '';
    let sessContent = options.sessionStartContent ?? '';

    if (!memContent) {
      try {
        if (existsSync(memPath)) {
          memContent = readFileSync(memPath, 'utf8');
        }
      } catch {
        memContent = '';
      }
    }

    if (!sessContent) {
      try {
        if (existsSync(sessPath)) {
          sessContent = readFileSync(sessPath, 'utf8');
        }
      } catch {
        sessContent = '';
      }
    }

    const bullets: RankABullet[] = [];

    // 1. Parse MEMORY.md hot layer (finds Quick context for new chats and parses its bullet points)
    const memLines = memContent.split('\n');
    const hotLayerText = memLines.slice(0, 250).join('\n');

    let inQuickContext = false;
    for (const line of memLines) {
      if (/^### Quick context for new chats/i.test(line)) {
        inQuickContext = true;
        continue;
      }
      if (inQuickContext && /^##+ /i.test(line)) {
        inQuickContext = false;
        break;
      }
      if (inQuickContext && /^\s*-\s+\*\*/.test(line)) {
        const bulletText = line.replace(/^\s*-\s+/, '').trim();
        const keyMatch = bulletText.match(/^\*\*([^*]+)\*\*/);
        bullets.push({
          category: 'memory-hot',
          content: bulletText,
          source: 'MEMORY.md',
          key: keyMatch ? keyMatch[1] : undefined,
        });
      }
    }

    // 2. Parse SESSION_START.md
    const sessLines = sessContent.split('\n');
    let currentFocus = '';
    let productPriority = '';
    const howWeWork: string[] = [];
    const ideDiscipline: string[] = [];
    const lastSessionHighlights: string[] = [];

    let currentSection = '';
    for (const line of sessLines) {
      if (/^## How we like to work/i.test(line)) {
        currentSection = 'how-we-work';
        continue;
      }
      if (/^## Current focus/i.test(line)) {
        currentSection = 'current-focus';
        continue;
      }
      if (/^## Product priority/i.test(line)) {
        currentSection = 'product-priority';
        continue;
      }
      if (/^## IDE discipline/i.test(line)) {
        currentSection = 'ide-discipline';
        continue;
      }
      if (/^## Last session/i.test(line)) {
        currentSection = 'last-session';
        continue;
      }
      if (/^## /i.test(line)) {
        currentSection = '';
        continue;
      }

      if (currentSection === 'how-we-work' && /^\s*-\s+/.test(line)) {
        const clean = line.replace(/^\s*-\s+/, '').trim();
        howWeWork.push(clean);
        bullets.push({
          category: 'session-discipline',
          content: clean,
          source: 'SESSION_START.md',
          key: 'How we like to work',
        });
      } else if (currentSection === 'current-focus' && line.trim() && !line.startsWith('#')) {
        currentFocus += (currentFocus ? ' ' : '') + line.trim();
      } else if (currentSection === 'product-priority' && line.trim() && !line.startsWith('#')) {
        productPriority += (productPriority ? ' ' : '') + line.trim();
      } else if (currentSection === 'ide-discipline' && /^\s*-\s+/.test(line)) {
        const clean = line.replace(/^\s*-\s+/, '').trim();
        ideDiscipline.push(clean);
        bullets.push({
          category: 'session-discipline',
          content: clean,
          source: 'SESSION_START.md',
          key: 'IDE discipline',
        });
      } else if (currentSection === 'last-session' && /^\s*-\s+/.test(line)) {
        const clean = line.replace(/^\s*-\s+/, '').trim();
        lastSessionHighlights.push(clean);
      }
    }

    if (currentFocus) {
      bullets.push({
        category: 'session-focus',
        content: currentFocus,
        source: 'SESSION_START.md',
        key: 'Current focus',
      });
    }

    if (productPriority) {
      bullets.push({
        category: 'session-priority',
        content: productPriority,
        source: 'SESSION_START.md',
        key: 'Product priority',
      });
    }

    // 3. Extract Gate blocks from SESSION_START.md (or MEMORY.md if absent)
    const cortexGate = this.parseCortexGate(sessContent || memContent);
    const epistemicGate = this.parseEpistemicGate(sessContent || memContent);

    if (cortexGate) {
      bullets.push({
        category: 'cortex-gate',
        content: cortexGate.raw,
        source: 'SESSION_START.md',
        key: 'Cortex Gate',
      });
    }

    if (epistemicGate) {
      bullets.push({
        category: 'epistemic-gate',
        content: epistemicGate.raw,
        source: 'SESSION_START.md',
        key: 'Epistemic Gate',
      });
    }

    const sessionState: SessionState = {
      currentFocus,
      productPriority,
      howWeWork,
      ideDiscipline,
      lastSessionHighlights,
      lastCortexGate: cortexGate,
      lastEpistemicGate: epistemicGate,
    };

    const integrityHash = this.computeSimpleHash(
      `${bullets.length}:${currentFocus.slice(0, 50)}:${cortexGate?.status}:${epistemicGate?.grade}`
    );

    this.identity = {
      agentName: 'SyncScript Operational Mind',
      framework: 'OpenClaw Perception + Cortex Metacontrol + Hermes Idempotent Act',
      truthBoundary: 'Goal B Operational Mind verified; Goal C Phenomenal Consciousness is undecidable in software (Neuron 2026).',
      loadedAt: Date.now(),
      memoryPath: memPath,
      sessionStartPath: sessPath,
      rankABullets: bullets,
      sessionState,
      hotLayerText,
      integrityHash,
    };

    this.loaded = true;
    return this.identity;
  }

  /**
   * Parse cortex gate markdown line
   */
  private parseCortexGate(text: string): CortexGateReport | null {
    const match = text.match(
      /\*\*Last cortex gate \(([^)]+)\):\*\*\s+\*\*([^*]+)\*\*\s+·\s+cortex-70\s+([^·]+)·\s+coverage\s+AVG\s+\*\*([0-9.]+)\*\*\s+\(GWT\s+([0-9.]+)\s+·\s+AST\s+([0-9.]+)\s+·\s+PP\s+([0-9.]+)\s+·\s+RPT\s+([0-9.]+)\s+·\s+HOT\s+([0-9.]+)\s+·\s+IIT\s+([0-9.]+)\)\s+·\s+git\s+`([^`]+)`/
    );

    if (!match) return null;

    return {
      timestamp: match[1],
      status: match[2].includes('PASS') ? 'PASS' : match[2].includes('FAIL') ? 'FAIL' : 'UNKNOWN',
      cortex70Score: match[3].trim(),
      coverageAvg: parseFloat(match[4]),
      components: {
        gwt: parseFloat(match[5]),
        ast: parseFloat(match[6]),
        pp: parseFloat(match[7]),
        rpt: parseFloat(match[8]),
        hot: parseFloat(match[9]),
        iit: parseFloat(match[10]),
      },
      gitSha: match[11],
      raw: match[0],
    };
  }

  /**
   * Parse epistemic homeostasis gate markdown line
   */
  private parseEpistemicGate(text: string): EpistemicGateReport | null {
    const match = text.match(
      /\*\*Last epistemic gate \(([^)]+)\):\*\*\s+\*\*([^*]+)\*\*\s+·\s+H=([0-9.]+)\s+·\s+F=([0-9.]+)\s+·\s+grade\s+\*\*([^*]+)\*\*\s+·[^\n]+claims=([0-9/]+)[^\n]+git\s+`([^`]+)`/
    );

    if (!match) return null;

    return {
      timestamp: match[1],
      status: match[2].includes('PASS') ? 'PASS' : match[2].includes('FAIL') ? 'FAIL' : 'UNKNOWN',
      h: parseFloat(match[3]),
      f: parseFloat(match[4]),
      grade: match[5],
      claimsCount: match[6],
      gitSha: match[7],
      raw: match[0],
    };
  }

  private computeSimpleHash(input: string): string {
    let hash = 0;
    for (let i = 0; i < input.length; i++) {
      hash = (hash << 5) - hash + input.charCodeAt(i);
      hash |= 0;
    }
    return Math.abs(hash).toString(16);
  }

  public getOperationalIdentity(): OperationalIdentity {
    if (!this.identity) {
      return this.loadRankA();
    }
    return this.identity;
  }

  public getRankABullets(): RankABullet[] {
    return this.getOperationalIdentity().rankABullets;
  }

  public getSessionState(): SessionState {
    return this.getOperationalIdentity().sessionState;
  }

  public isLoaded(): boolean {
    return this.loaded;
  }

  public reload(): OperationalIdentity {
    return this.loadRankA();
  }

  /**
   * Verify integrity of loaded Rank A memory bullets
   */
  public verifyMemoryIntegrity(): {
    valid: boolean;
    issues: string[];
    stats: { bulletsLoaded: number; hotLayerChars: number; gatePass: boolean };
  } {
    const id = this.getOperationalIdentity();
    const issues: string[] = [];

    if (id.rankABullets.length === 0) {
      issues.push('No Rank A bullets loaded from MEMORY.md / SESSION_START.md.');
    }

    if (!id.sessionState.lastCortexGate || id.sessionState.lastCortexGate.status !== 'PASS') {
      issues.push('Cortex gate is missing or not in PASS status.');
    }

    if (!id.sessionState.lastEpistemicGate || id.sessionState.lastEpistemicGate.status !== 'PASS') {
      issues.push('Epistemic homeostasis gate is missing or not in PASS status.');
    }

    if (!id.hotLayerText || id.hotLayerText.length < 500) {
      issues.push('Hot layer text is suspiciously short (< 500 characters).');
    }

    const gatePass =
      Boolean(id.sessionState.lastCortexGate?.status === 'PASS') &&
      Boolean(id.sessionState.lastEpistemicGate?.status === 'PASS');

    return {
      valid: issues.length === 0,
      issues,
      stats: {
        bulletsLoaded: id.rankABullets.length,
        hotLayerChars: id.hotLayerText.length,
        gatePass,
      },
    };
  }

  /**
   * Format loaded Rank A context into a clean system prompt section for agents
   */
  public buildSystemPromptContext(options: { maxBullets?: number; includeGates?: boolean } = {}): string {
    const id = this.getOperationalIdentity();
    const maxBullets = options.maxBullets ?? 15;
    const includeGates = options.includeGates !== false;

    const sections: string[] = [];
    sections.push('### Operational Mind Continuity Spine (Rank A Invariants)');
    sections.push(`- **Architecture:** ${id.framework}`);
    sections.push(`- **Truth Boundary:** ${id.truthBoundary}`);

    if (id.sessionState.currentFocus) {
      sections.push(`- **Current Focus:** ${id.sessionState.currentFocus}`);
    }
    if (id.sessionState.productPriority) {
      sections.push(`- **Product Priority:** ${id.sessionState.productPriority}`);
    }

    if (includeGates) {
      if (id.sessionState.lastCortexGate) {
        sections.push(
          `- **Verified Cortex Gate:** ${id.sessionState.lastCortexGate.status} (Coverage AVG ${id.sessionState.lastCortexGate.coverageAvg.toFixed(2)}, sha ${id.sessionState.lastCortexGate.gitSha})`
        );
      }
      if (id.sessionState.lastEpistemicGate) {
        sections.push(
          `- **Verified Epistemic Gate:** ${id.sessionState.lastEpistemicGate.status} (H=${id.sessionState.lastEpistemicGate.h.toFixed(3)}, grade ${id.sessionState.lastEpistemicGate.grade}, sha ${id.sessionState.lastEpistemicGate.gitSha})`
        );
      }
    }

    sections.push('\n#### Key Rank A Operational Bullets:');
    const selectedBullets = id.rankABullets
      .filter((b) => b.category === 'memory-hot' || b.category === 'session-discipline')
      .slice(0, maxBullets);

    for (const bullet of selectedBullets) {
      sections.push(`- ${bullet.content}`);
    }

    return sections.join('\n');
  }
}

/** Global singleton identity spine */
export const identitySpine = new IdentitySpine();
