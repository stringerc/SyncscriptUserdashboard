import React, { createContext, useContext, useState, useCallback, useEffect, useRef } from 'react';
import { bridgeFetch } from './bridge-client';

// Shared mood between CortanaLive + CortanaControl; debounced Govee sync when bridge is up

const MOODS = ['idle', 'listening', 'thinking', 'speaking', 'alert'] as const;
export type CortanaMood = (typeof MOODS)[number];

interface CortanaMoodContextValue {
  mood: CortanaMood;
  setMood: (mood: CortanaMood) => void;
  cycleMood: () => void;
}

const CortanaMoodContext = createContext<CortanaMoodContextValue>({
  mood: 'idle',
  setMood: () => {},
  cycleMood: () => {},
});

export function CortanaMoodProvider({ children }: { children: React.ReactNode }) {
  const [mood, setMoodState] = useState<CortanaMood>('idle');
  const lastGoveeMood = useRef<string>('');
  const goveeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const goveeCooldownUntil = useRef(0);

  const setMood = useCallback((next: CortanaMood) => {
    setMoodState(next);
  }, []);

  const cycleMood = useCallback(() => {
    setMoodState((prev) => {
      const idx = MOODS.indexOf(prev);
      return MOODS[(idx + 1) % MOODS.length];
    });
  }, []);

  // Debounce govee when mood changes; skip bootstrap; respect 429 cooldown
  const mountedRef = useRef(false);
  useEffect(() => {
    if (!mountedRef.current) {
      mountedRef.current = true;
      lastGoveeMood.current = mood;
      return;
    }
    if (goveeTimer.current) clearTimeout(goveeTimer.current);
    goveeTimer.current = setTimeout(() => {
      if (lastGoveeMood.current === mood) return;
      if (Date.now() < goveeCooldownUntil.current) return;
      lastGoveeMood.current = mood;
      void bridgeFetch('/api/cortana/govee/mood', {
        method: 'PUT',
        timeoutMs: 5000,
        body: JSON.stringify({ mood }),
      })
        .then((res) => {
          if (res.status === 429) {
            goveeCooldownUntil.current = Date.now() + 120_000;
          }
        })
        .catch(() => {});
    }, 800);
    return () => {
      if (goveeTimer.current) clearTimeout(goveeTimer.current);
    };
  }, [mood]);

  return (
    <CortanaMoodContext.Provider value={{ mood, setMood, cycleMood }}>
      {children}
    </CortanaMoodContext.Provider>
  );
}

export function useCortanaMood() {
  return useContext(CortanaMoodContext);
}
