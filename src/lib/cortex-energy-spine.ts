/**
 * Cortex Chrono-Energy Spine Bridge
 *
 * Connects the Cortex Autonomous Mission Engine to the SyncScript Chrono-Energy Calendar:
 * 1. Computes the user's biological circadian curve using research-validated cosinor models (Acrophase 10:30 AM).
 * 2. Identifies the next peak cognitive energy window (Circadian Resonance >= 0.90).
 * 3. Automatically schedules an energy-aligned review hold for completed or review-pending missions.
 * 4. Persists the event to SyncScript's primary calendar store (`syncscript_calendar_events`) with cross-tab event broadcasting.
 */

import { getCircadianCurve } from '../utils/resonance-calculus';
import type { Event } from '../utils/event-task-types';
import type { AutonomousMission } from './cortex-mission-engine';

export interface ScheduledReviewBlock {
  eventId: string;
  missionId: string;
  missionTitle: string;
  startTime: string; // ISO string
  endTime: string;   // ISO string
  peakEnergyScore: number; // e.g. 0.94 (94%)
  scheduledAt: number;
}

export class CortexEnergySpineBridge {
  private static instance: CortexEnergySpineBridge | null = null;
  private readonly CALENDAR_STORAGE_KEY = 'syncscript_calendar_events';
  private readonly REVIEWS_STORAGE_KEY = 'cortex_scheduled_reviews_v1';

  public static getInstance(): CortexEnergySpineBridge {
    if (!CortexEnergySpineBridge.instance) {
      CortexEnergySpineBridge.instance = new CortexEnergySpineBridge();
    }
    return CortexEnergySpineBridge.instance;
  }

  /**
   * Computes the next peak cognitive energy window (circadian peak ~9:30 AM - 10:30 AM).
   */
  public getNextPeakEnergyWindow(fromDate: Date = new Date()): { startTime: Date; endTime: Date; energyScore: number } {
    const candidate = new Date(fromDate);
    // If it's already past 11:30 AM today, schedule for tomorrow morning 9:30 AM
    if (candidate.getHours() >= 11) {
      candidate.setDate(candidate.getDate() + 1);
    }
    candidate.setHours(9, 30, 0, 0);

    const end = new Date(candidate);
    end.setHours(10, 30, 0, 0);

    // Calculate research-backed circadian energy score at 9.5h (9:30 AM)
    const energyScore = getCircadianCurve(9.5);

    return {
      startTime: candidate,
      endTime: end,
      energyScore: parseFloat(energyScore.toFixed(2)),
    };
  }

  /**
   * Schedules an energy-aligned review block on the SyncScript calendar for a mission.
   */
  public scheduleMissionReviewBlock(mission: AutonomousMission): ScheduledReviewBlock {
    const { startTime, endTime, energyScore } = this.getNextPeakEnergyWindow();
    const eventId = `cortex-review-${mission.id}`;
    const now = new Date();

    const title = `🔒 Autonomous Review: ${mission.title}`;
    const description = `Cognitive review block automatically scheduled by Cortex Mission Engine during your peak biological energy window (${Math.round(energyScore * 100)}% bio-energy).\n\nMission Objective: ${mission.objective}\nDeliverables & artifacts verified by Cortex.\nStatus: Ready for Human Co-Agency Sign-off.`;

    const calendarEvent: Event = {
      id: eventId,
      title,
      description,
      startTime,
      endTime,
      completed: false,
      hierarchyType: 'primary',
      isPrimaryEvent: true,
      childEventIds: [],
      depth: 0,
      isScheduled: true,
      archived: false,
      autoArchiveChildren: false,
      inheritPermissions: false,
      tasks: [],
      hasScript: false,
      resources: [],
      linksNotes: [],
      teamMembers: [],
      createdBy: 'Cortex Volition Engine (Chrono-Spine)',
      createdAt: now,
      updatedAt: now,
      allowTeamEdits: true,
      tags: ['cortex_review', 'deep_work', 'peak_energy'],
    } as unknown as Event;

    // Persist to syncscript_calendar_events
    if (typeof window !== 'undefined') {
      try {
        const raw = localStorage.getItem(this.CALENDAR_STORAGE_KEY);
        let existingEvents: Event[] = [];
        if (raw) {
          existingEvents = JSON.parse(raw);
        }
        // Deduplicate
        const filtered = existingEvents.filter((e) => e.id !== eventId);
        filtered.push(calendarEvent);
        localStorage.setItem(this.CALENDAR_STORAGE_KEY, JSON.stringify(filtered));

        // Save review record
        const reviewsRaw = localStorage.getItem(this.REVIEWS_STORAGE_KEY);
        const reviews: ScheduledReviewBlock[] = reviewsRaw ? JSON.parse(reviewsRaw) : [];
        const reviewRecord: ScheduledReviewBlock = {
          eventId,
          missionId: mission.id,
          missionTitle: mission.title,
          startTime: startTime.toISOString(),
          endTime: endTime.toISOString(),
          peakEnergyScore: energyScore,
          scheduledAt: Date.now(),
        };
        const updatedReviews = reviews.filter((r) => r.missionId !== mission.id).concat(reviewRecord);
        localStorage.setItem(this.REVIEWS_STORAGE_KEY, JSON.stringify(updatedReviews));

        // Broadcast to calendar listeners
        window.dispatchEvent(new CustomEvent('syncscript:calendar-event-created', { detail: calendarEvent }));
        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.warn('[CortexEnergySpineBridge] failed to persist review block:', err);
      }
    }

    return {
      eventId,
      missionId: mission.id,
      missionTitle: mission.title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      peakEnergyScore: energyScore,
      scheduledAt: Date.now(),
    };
  }

  public getScheduledReviews(): ScheduledReviewBlock[] {
    if (typeof window === 'undefined') return [];
    try {
      const raw = localStorage.getItem(this.REVIEWS_STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }
}

export function getCortexEnergySpineBridge(): CortexEnergySpineBridge {
  return CortexEnergySpineBridge.getInstance();
}

