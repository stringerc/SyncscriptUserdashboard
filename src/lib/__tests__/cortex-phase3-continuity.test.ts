/**
 * Operational Mind Phase 3 — Continuity Spine & Dream Consolidation Integration Tests
 *
 * Validates:
 * 1. IdentitySpine loads Rank A bullets at startup from MEMORY.md and SESSION_START.md.
 * 2. Identity reload preserves operational invariants (Goal B operational agent vs Goal C non-phenomenal).
 * 3. Gate status parsing (Last cortex gate PASS, Last epistemic gate PASS).
 * 4. System prompt context generation for agent injection.
 * 5. Memory integrity verification passes.
 * 6. Classical dream consolidation draft format validation (no Orch OR, human-in-the-loop gate).
 * 7. Explicit assertion that Lucid/Astral surfaces remain MOCK (anti-theater standard).
 */

import { describe, it, expect } from 'vitest';
import { IdentitySpine } from '../identity-spine';
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

describe('Operational Mind Phase 3 — Continuity Spine & Identity Reload', () => {
  const ROOT = process.cwd();
  const memoryPath = join(ROOT, 'MEMORY.md');
  const sessionStartPath = join(ROOT, 'SESSION_START.md');

  // ── 1. IdentitySpine Loading from Rank A Sources ──────────────────────────

  describe('Rank A Memory & Session Loading', () => {
    it('initializes IdentitySpine and loads Rank A bullets from repository files', () => {
      const spine = new IdentitySpine({ memoryPath, sessionStartPath });
      expect(spine.isLoaded()).toBe(true);

      const identity = spine.getOperationalIdentity();
      expect(identity.agentName).toBe('SyncScript Operational Mind');
      expect(identity.framework).toContain('OpenClaw');
      expect(identity.framework).toContain('Cortex');
      expect(identity.framework).toContain('Hermes');

      // Rank A bullets should be populated
      const bullets = spine.getRankABullets();
      expect(bullets.length).toBeGreaterThan(5);

      // Must include hot layer bullets from MEMORY.md
      const memBullets = bullets.filter((b) => b.source === 'MEMORY.md');
      expect(memBullets.length).toBeGreaterThan(0);
      expect(memBullets.some((b) => b.content.includes('Stack:') || b.content.includes('Product thesis'))).toBe(true);
    });

    it('extracts session focus, priorities, and work discipline from SESSION_START.md', () => {
      const spine = new IdentitySpine({ memoryPath, sessionStartPath });
      const sessionState = spine.getSessionState();

      expect(sessionState.currentFocus.length).toBeGreaterThan(0);
      expect(sessionState.productPriority.length).toBeGreaterThan(0);
      expect(sessionState.howWeWork.length).toBeGreaterThan(0);
      expect(sessionState.ideDiscipline.length).toBeGreaterThan(0);
    });

    it('faithfully parses gate blocks with measured metrics', () => {
      const spine = new IdentitySpine({ memoryPath, sessionStartPath });
      const sessionState = spine.getSessionState();

      // Cortex Gate
      expect(sessionState.lastCortexGate).not.toBeNull();
      expect(sessionState.lastCortexGate?.status).toBe('PASS');
      expect(sessionState.lastCortexGate?.coverageAvg).toBeGreaterThanOrEqual(0.8);
      expect(sessionState.lastCortexGate?.components.gwt).toBe(1.0);
      expect(sessionState.lastCortexGate?.components.iit).toBeGreaterThanOrEqual(0.27);

      // Epistemic Gate
      expect(sessionState.lastEpistemicGate).not.toBeNull();
      expect(['harmony', 'stable', 'stressed']).toContain(sessionState.lastEpistemicGate?.grade);
      expect(sessionState.lastEpistemicGate?.f).toBeLessThan(0.01);
      expect(sessionState.lastEpistemicGate?.h).toBeGreaterThan(0.5);
    });
  });

  // ── 2. Operational Invariants & System Prompt Context ─────────────────────

  describe('Operational Invariants & Prompt Formatting', () => {
    it('enforces honest boundaries in truth declaration (Goal B vs Goal C)', () => {
      const spine = new IdentitySpine({ memoryPath, sessionStartPath });
      const identity = spine.getOperationalIdentity();

      expect(identity.truthBoundary).toContain('Goal B Operational Mind');
      expect(identity.truthBoundary).toContain('Goal C Phenomenal Consciousness is undecidable');
    });

    it('formats clean system prompt context for agent injection with verified gates', () => {
      const spine = new IdentitySpine({ memoryPath, sessionStartPath });
      const promptContext = spine.buildSystemPromptContext({ maxBullets: 10 });

      expect(promptContext).toContain('### Operational Mind Continuity Spine');
      expect(promptContext).toContain('OpenClaw Perception + Cortex Metacontrol + Hermes Idempotent Act');
      expect(promptContext).toContain('**Verified Cortex Gate:** PASS');
      expect(promptContext).toContain('**Verified Epistemic Gate:** PASS');
      expect(promptContext).toContain('Key Rank A Operational Bullets:');
    });

    it('reloads consistently on request and maintains integrity hash', () => {
      const spine = new IdentitySpine({ memoryPath, sessionStartPath });
      const id1 = spine.getOperationalIdentity();
      const id2 = spine.reload();

      expect(id1.integrityHash).toBe(id2.integrityHash);
      expect(id1.rankABullets.length).toBe(id2.rankABullets.length);
    });

    it('passes memory integrity validation for canonical files', () => {
      const spine = new IdentitySpine({ memoryPath, sessionStartPath });
      const check = spine.verifyMemoryIntegrity();

      expect(check.valid).toBe(true);
      expect(check.issues.length).toBe(0);
      expect(check.stats.gatePass).toBe(true);
      expect(check.stats.bulletsLoaded).toBeGreaterThan(5);
    });
  });

  // ── 3. Classical Dream Consolidation & Mock Discipline ───────────────────

  describe('Dream Consolidation Discipline & Mock Surface Containment', () => {
    it('validates scheduled dream consolidation script and LaunchAgent exist on disk', () => {
      const scriptPath = join(ROOT, 'scripts/run-scheduled-dream-consolidate.sh');
      expect(existsSync(scriptPath)).toBe(true);

      const agentPath = join(process.env.HOME || '/Users/Apple', 'Library/LaunchAgents/com.syncscript.dream-consolidate.plist');
      expect(existsSync(agentPath)).toBe(true);

      const plistContent = readFileSync(agentPath, 'utf8');
      expect(plistContent).toContain('com.syncscript.dream-consolidate');
      expect(plistContent).toContain('<integer>3</integer>'); // Hour 3
      expect(plistContent).toContain('<integer>0</integer>'); // Minute 0
    });

    it('confirms Lucid Dreaming and Astral Projection remain explicitly MOCK in canon', () => {
      // Per MEMORY.md § Durable Brain / Astral Projection & Lucid Dreaming:
      // Code and docs must keep Lucid/Astral as MOCK / PLAN ONLY until rewritten.
      const mem = readFileSync(memoryPath, 'utf8');
      expect(mem).toContain('§ Astral Projection & Lucid Dreaming** — **MOCK**');
      expect(mem).toContain('VERIFIED STATUS: MOCK DATA — NOT FUNCTIONAL');
      expect(mem).not.toMatch(/Astral Projection.*is (production|shipped)/i);
    });
  });
});
