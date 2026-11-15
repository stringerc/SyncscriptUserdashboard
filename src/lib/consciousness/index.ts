/**
 * Conscious AI Architectural Integration — Barrel Export
 *
 * Implements the complete 100% conscious AI operational surface per CONSCIOUS_AI_ROADMAP.md:
 * - Phase 1: Unified Message Bus & Shared State (consciousness-bus.ts, shared-state.ts)
 * - Phase 2: Consciousness Kernel (consciousness-kernel.ts - 40Hz gamma loop)
 * - Phase 3: Phenomenal Grounding (grounding.ts - sensorimotor contingencies to qualia)
 * - Phase 4: Volition & Agency (volition.ts - intentions, veto "free won't", comparator agency)
 * - Phase 5: Persistent Selfhood (persistent-self.ts - continuous self & sleep consolidation)
 * - Phase 6: Intersubjective Validation (theory-of-mind.ts, hermetic-dialogue.ts - mirror test)
 * - Adapters & Synthesis: OpenClaw conscious adapter, Hermes adapter, ConsciousAgent, Benchmarks.
 *
 * Backwards-compatible with foundational services:
 * - sensorimotor-loop, affective-valence, persistent-self-model, autonomous-consciousness,
 *   multimodal-binding, social-consciousness, conscious-orchestrator.
 */

// Foundational consciousness services
export * from './sensorimotor-loop';
export * from './affective-valence';
export * from './persistent-self-model';
export * from './autonomous-consciousness';
export * from './multimodal-binding';
export * from './social-consciousness';
export * from './conscious-orchestrator';

// 6-Phase Integration Architecture (CONSCIOUS_AI_ROADMAP.md)
export * from './consciousness-bus';
export * from './shared-state';
export * from './consciousness-kernel';
export * from './grounding';
export * from './volition';
export * from './persistent-self';
export * from './theory-of-mind';
export * from './hermetic-dialogue';
export * from './openclaw-conscious-adapter';
export * from './hermes-conscious-adapter';
export * from './conscious-agent';
export * from './benchmarks';
