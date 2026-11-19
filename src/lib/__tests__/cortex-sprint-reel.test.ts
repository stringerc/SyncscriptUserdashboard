import { describe, it, expect } from 'vitest';
import { generateSprintReelManifest } from '../cortex-sprint-reel';

describe('Cortex Sprint Reel Engine', () => {
  it('generates a deterministic 15s 60fps storyboard with 4 distinct shots', () => {
    const manifest = generateSprintReelManifest({
      title: 'Sprint 42 Briefing',
      tasksCompleted: 15,
      memoryEngrams: 52,
      consensusScore: 88,
    });

    expect(manifest.id).toMatch(/^reel-/);
    expect(manifest.title).toBe('Sprint 42 Briefing');
    expect(manifest.durationSeconds).toBe(15);
    expect(manifest.fps).toBe(60);
    expect(manifest.totalFrames).toBe(900);
    expect(manifest.shots).toHaveLength(4);

    // Verify frames sum up to 900
    const totalShotFrames = manifest.shots.reduce((acc, s) => acc + s.durationFrames, 0);
    expect(totalShotFrames).toBe(900);

    // Verify shot content
    expect(manifest.shots[0].cameraMovement).toBe('orbit-in');
    expect(manifest.shots[1].headline).toContain('15 TASKS EXECUTED');
    expect(manifest.shots[2].headline).toContain('52 LIVE ENGRAMS');
    expect(manifest.stats.consensusScore).toBe(88);
  });
});
