/**
 * Weather Space Modal — singleton store.
 *
 * When a get_weather tool call resolves, the voice/chat pipeline pushes
 * the WeatherArtifact here and WeatherSpaceModal (mounted at the root of
 * CortexVisualizerPage) renders it as a focused overlay on the 3D space.
 * The artifact ALSO keeps its normal surfaces (inline chat card + pinned
 * surface panel) — the modal is the hero glance, not a replacement.
 */

import { useSyncExternalStore } from 'react';
import type { WeatherArtifact } from './cortex-artifacts';

let current: WeatherArtifact | null = null;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

export function openWeatherModal(artifact: WeatherArtifact) {
  current = artifact;
  emit();
}

export function closeWeatherModal() {
  if (!current) return;
  current = null;
  emit();
}

export function useWeatherModal(): WeatherArtifact | null {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => { listeners.delete(cb); };
    },
    () => current,
  );
}
