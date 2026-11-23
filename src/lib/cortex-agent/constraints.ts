/**
 * Constraint Model — the "what you can spend" half of strategic
 * partnership. Goals declare what the user wants; constraints declare
 * the limits strategy must respect: time budgets, risk tolerance,
 * freezes ("no client work until Q3"), spending caps.
 *
 * Backed by persistentStore ('cortex:constraints:v1') — durable under
 * Node via the persistent-store file mirror, so constraints survive
 * restarts alongside goals.
 */

import { persistentStore } from '../persistent-store';

export type ConstraintKind = 'time_budget' | 'risk' | 'freeze' | 'spend' | 'other';

export interface LifeConstraint {
  id: string;
  kind: ConstraintKind;
  /** Human-readable rule, e.g. "≤10h/week on side projects". */
  rule: string;
  /** Optional structured detail — hours per week, date boundary, etc. */
  detail?: Record<string, unknown>;
  active: boolean;
  createdAt: number;
}

const STORAGE_KEY = 'cortex:constraints:v1';

function load(): LifeConstraint[] {
  try {
    const raw = persistentStore.getItem(STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch { return []; }
}

function save(list: LifeConstraint[]): void {
  try { persistentStore.setItem(STORAGE_KEY, JSON.stringify(list.slice(-100))); } catch {}
}

export function declareConstraint(input: {
  kind?: ConstraintKind;
  rule: string;
  detail?: Record<string, unknown>;
}): LifeConstraint | { error: string } {
  const rule = String(input.rule || '').trim();
  if (!rule) return { error: 'rule required' };
  const list = load();
  // Dedupe on identical active rule.
  const dup = list.find(c => c.active && c.rule.toLowerCase() === rule.toLowerCase());
  if (dup) return dup;
  const c: LifeConstraint = {
    id: `con-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    kind: input.kind && ['time_budget', 'risk', 'freeze', 'spend', 'other'].includes(input.kind) ? input.kind : 'other',
    rule: rule.slice(0, 300),
    detail: input.detail,
    active: true,
    createdAt: Date.now(),
  };
  list.push(c);
  save(list);
  return c;
}

export function listConstraints(activeOnly = true): LifeConstraint[] {
  const list = load();
  return activeOnly ? list.filter(c => c.active) : list;
}

export function removeConstraint(id: string): boolean {
  const list = load();
  const idx = list.findIndex(c => c.id === id);
  if (idx === -1) return false;
  list.splice(idx, 1);
  save(list);
  return true;
}

/** Compact digest for prompts — one line per active constraint. */
export function constraintDigest(): string {
  const active = listConstraints(true);
  if (!active.length) return '';
  return '\nCONSTRAINTS (strategy must respect these):\n'
    + active.map(c => `- [${c.kind}] ${c.rule}`).join('\n');
}
