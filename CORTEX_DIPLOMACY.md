# Cortex-to-Cortex Diplomacy — Protocol Specification (Phase 5.3)

**Status:** specification + deterministic prototype (`src/lib/cortex-diplomacy.ts`).
**Blocked on:** Phase 3 trust ledger in production — agents must be accountable before they negotiate.

## 1. Purpose

Let two Cortex instances (belonging to different humans) negotiate on their
principals' behalf: meeting slots, shared deadlines, resource conflicts,
information exchange. The human never lifts a finger until escrow.

## 2. Message envelope

```json
{
  "id": "msg-<ts>-<seq>",
  "threadId": "thread-<ts>",
  "from": "cortex-<principal-hash>",
  "to": "cortex-<principal-hash>",
  "type": "proposal|counter|accept|reject|escrow_request|escrow_release|abort",
  "payload": {},
  "humanEscrowRef": "<opaque ref to human approval>",
  "at": <epoch-ms>
}
```

Rules:
- `accept`/`escrow_release` without a valid `humanEscrowRef` MUST be rejected
  by the receiver. Commitments are human-gated, always.
- Every message is appended to an immutable transcript both parties retain.
- `abort` is always honored; either agent or either human can terminate.

## 3. Transport & authentication (future)

- Pairing: out-of-band code exchange (like the existing mobile pairing flow)
  establishes a shared secret; envelopes are HMAC-signed.
- Transport: local-first — a relay file/endpoint per host
  (`/api/cortex/diplomacy/inbox`) with pull-based delivery. No third-party
  cloud in v1.
- Identity: `from`/`to` are principal-scoped pseudonyms, never raw user data.

## 4. Negotiation transcript format

Append-only JSONL per thread:

```
{"seq":1,"type":"proposal","slot":{...},"sig":"hmac-sha256"}
{"seq":2,"type":"counter","slot":{...},"sig":"..."}
{"seq":3,"type":"accept","slot":{...},"escrow":"human-approval-9f2"}
```

Disputes resolve against the transcript — the ledger of record.

## 5. Human-in-the-loop escrow

1. Agents may propose, counter, and rank freely.
2. `accept` generates an `escrow_request` surfaced to BOTH humans
   ("Cortex-A and Cortex-B agree on Thursday 14:00 — approve?").
3. Only after both humans approve does `escrow_release` fire and the
   commitment bind (calendar hold, deadline ack).
4. Either human can veto at any point before release; the transcript
   records the veto.

## 6. Kill criteria / open questions

- Do negotiated commitments actually reduce scheduling friction, or add a
  second inbox to check? Measure time-to-agreement vs. manual scheduling.
- Privacy: what may agents disclose about their principal's calendar
  density without leaking contents? Free/busy only in v1.
- Abuse: a hostile or compromised peer agent. Rate limits, offer quotas,
  and a human-visible transcript are the v1 mitigations.
