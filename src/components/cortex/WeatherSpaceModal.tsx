/**
 * WeatherSpaceModal — focused weather overlay for the Cortex space.
 *
 * Opens when a get_weather turn resolves (see cortex-weather-modal store).
 * The card itself is WeatherCard — the SAME component the pinned surface
 * panel renders — so modal and panel share one theme by construction.
 * Esc / ✕ / backdrop click dismiss; 📌 pins the artifact to the space.
 */

import { useEffect } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Pin } from 'lucide-react';
import type { WeatherArtifact } from '../../lib/cortex-artifacts';
import { closeWeatherModal, useWeatherModal } from '../../lib/cortex-weather-modal';
import { openSurfacePanel } from '../../lib/cortex-surfaces';
import { WeatherCard } from './WeatherCard';

export function WeatherSpaceModal() {
  const artifact = useWeatherModal();
  const a: WeatherArtifact | null = artifact;

  useEffect(() => {
    if (!a) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeWeatherModal(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [a]);

  return (
    <AnimatePresence>
      {a && (
        <motion.div
          key="weather-space-modal"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.22 }}
          onClick={closeWeatherModal}
          style={{
            position: 'fixed', inset: 0, zIndex: 120,
            background: 'rgba(30,80,160,0.28)',
            backdropFilter: 'blur(10px)', WebkitBackdropFilter: 'blur(10px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 20, cursor: 'pointer',
          }}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 28 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.94, y: 16 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
            onClick={(e) => e.stopPropagation()}
            style={{ width: 'min(400px, 94vw)', maxHeight: '88vh', overflowY: 'auto', cursor: 'default' }}
          >
            <WeatherCard
              a={a}
              actions={
                <div style={{ display: 'flex', gap: 6 }}>
                  <button
                    onClick={() => {
                      // Pin = dock the artifact as a persistent surface panel
                      // (renders WeatherCard + radar). Modal closes — the
                      // panel is the keep.
                      try {
                        openSurfacePanel({
                          kind: 'artifact',
                          title: a.title || 'Weather',
                          artifact: a,
                          pinned: true,
                        });
                      } catch { }
                      closeWeatherModal();
                    }}
                    aria-label="Pin weather to space"
                    title="Pin to space"
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.55)',
                      background: 'rgba(255,255,255,0.35)', color: '#12335c', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <Pin size={13} />
                  </button>
                  <button
                    onClick={closeWeatherModal}
                    aria-label="Close weather"
                    style={{
                      width: 28, height: 28, borderRadius: 8, border: '1px solid rgba(255,255,255,0.55)',
                      background: 'rgba(255,255,255,0.35)', color: '#12335c', cursor: 'pointer',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}
                  >
                    <X size={13} />
                  </button>
                </div>
              }
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

export default WeatherSpaceModal;
