/**
 * cortex-diplomacy.ts — Cortex-to-Cortex negotiation prototype (Phase 5.3 spike).
 *
 * Spec-only phase deliverable plus a minimal deterministic prototype: two
 * local agent instances negotiate a meeting slot through a structured
 * envelope protocol. Real deployment needs mutual authentication, an
 * immutable transcript, and human-in-the-loop escrow for commitments —
 * those are specified in CORTEX_DIPLOMACY.md, not implemented here.
 *
 * This prototype proves the envelope + turn-taking mechanics only.
 */

export type DiplomacyMessageType =
  | 'proposal'
  | 'counter'
  | 'accept'
  | 'reject'
  | 'escrow_request'
  | 'escrow_release'
  | 'abort';

export interface DiplomacyEnvelope {
  id: string;
  threadId: string;
  from: string;               // agent instance id, e.g. 'cortex-chris'
  to: string;
  type: DiplomacyMessageType;
  payload: Record<string, unknown>;
  /** Human-in-the-loop escrow: commitments require a human signature ref. */
  humanEscrowRef?: string;
  at: number;
}

export interface SlotOffer {
  start: number;              // epoch ms
  end: number;
  label?: string;
}

export interface NegotiationResult {
  agreed: SlotOffer | null;
  transcript: DiplomacyEnvelope[];
  rounds: number;
  escrowed: boolean;
}

let msgCounter = 0;

function envelope(
  threadId: string,
  from: string,
  to: string,
  type: DiplomacyMessageType,
  payload: Record<string, unknown>,
  humanEscrowRef?: string,
): DiplomacyEnvelope {
  return {
    id: `msg-${Date.now()}-${++msgCounter}`,
    threadId,
    from,
    to,
    type,
    payload,
    humanEscrowRef,
    at: Date.now(),
  };
}

/**
 * Deterministic two-party slot negotiation.
 * `prefsA`/`prefsB` are ranked candidate slots (best first).
 * Each party accepts the highest-ranked mutually-available slot, or
 * counters down its own list. Agreement requires human escrow ref on
 * the accept message — simulating HITL commitment gating.
 */
export function negotiateMeetingSlot(
  agentA: string,
  agentB: string,
  prefsA: SlotOffer[],
  prefsB: SlotOffer[],
  humanEscrowRef?: string,
): NegotiationResult {
  const threadId = `thread-${Date.now()}`;
  const transcript: DiplomacyEnvelope[] = [];
  const sameSlot = (a: SlotOffer, b: SlotOffer) => a.start === b.start && a.end === b.end;

  // A proposes its top choice.
  const proposal = envelope(threadId, agentA, agentB, 'proposal', { slot: prefsA[0] });
  transcript.push(proposal);

  // B counters with its own top choice if different, else accepts.
  let agreed: SlotOffer | null = null;
  let escrowed = false;
  let rounds = 1;

  if (!prefsB.length) {
    transcript.push(envelope(threadId, agentB, agentA, 'reject', { reason: 'no availability' }));
    return { agreed, transcript, rounds, escrowed };
  }

  if (sameSlot(prefsA[0], prefsB[0])) {
    const accept = envelope(threadId, agentB, agentA, 'accept', { slot: prefsB[0] }, humanEscrowRef);
    transcript.push(accept);
    agreed = prefsB[0];
    escrowed = !!humanEscrowRef;
    return { agreed, transcript, rounds, escrowed };
  }

  const counter = envelope(threadId, agentB, agentA, 'counter', { slot: prefsB[0] });
  transcript.push(counter);
  rounds++;

  // A scans its ranked list for B's counter; if none, counters back with next.
  const match = prefsA.find(s => sameSlot(s, prefsB[0]));
  if (match) {
    const accept = envelope(threadId, agentA, agentB, 'accept', { slot: match }, humanEscrowRef);
    transcript.push(accept);
    agreed = match;
    escrowed = !!humanEscrowRef;
    return { agreed, transcript, rounds, escrowed };
  }

  // One more round: B checks A's fallback (prefsA[1]) against its own list.
  const fallback = prefsA[1];
  if (fallback) {
    const counter2 = envelope(threadId, agentA, agentB, 'counter', { slot: fallback });
    transcript.push(counter2);
    rounds++;
    const bMatch = prefsB.find(s => sameSlot(s, fallback));
    if (bMatch) {
      const accept = envelope(threadId, agentB, agentA, 'accept', { slot: bMatch }, humanEscrowRef);
      transcript.push(accept);
      agreed = bMatch;
      escrowed = !!humanEscrowRef;
    }
  }

  if (!agreed) {
    transcript.push(envelope(threadId, agentB, agentA, 'abort', { reason: 'no mutually acceptable slot in prototype horizon' }));
  }
  return { agreed, transcript, rounds, escrowed };
}
