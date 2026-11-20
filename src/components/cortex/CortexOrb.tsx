/**
 * CortexOrb — thinking-orbs (Jakubantalik/thinking-orbs) driven by the
 * cortexSignalBus. Nine hand-tuned dotted-orb states mapped onto Cortex
 * voice states; pure 2D canvas, no WebGL, no lighting — the equator
 * problem cannot exist here by construction.
 *
 * Mount with ?orb=1 on /cortex/visualizer.
 */

import React, { useEffect, useState } from 'react';
import { ThinkingOrb, type OrbState } from 'thinking-orbs';
import { cortexSignalBus, type CortexVoiceState } from './CortexVisualizer';

const STATE_MAP: Record<CortexVoiceState, { orb: OrbState; color: string }> = {
  idle:      { orb: 'breathing',  color: '#38d9f5' },
  listening: { orb: 'listening',  color: '#34d399' },
  thinking:  { orb: 'solving',    color: '#a78bfa' },
  speaking:  { orb: 'composing',  color: '#fcd34d' },
  working:   { orb: 'working',    color: '#e879f9' },
};

export function CortexOrb() {
  const [state, setState] = useState<CortexVoiceState>('idle');
  useEffect(() => cortexSignalBus.subscribe((p) => {
    if (p.state) setState(p.state);
  }), []);
  const cfg = STATE_MAP[state] ?? STATE_MAP.idle;
  return (
    <div style={{
      position: 'absolute', inset: 0, display: 'flex',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(3,4,10,0.2) 0%, rgba(3,4,10,0.88) 78%)',
      zIndex: 5,
    }}>
      <div style={{
        width: 64, height: 64,
        transform: 'scale(6)',
        transformOrigin: 'center',
        filter: 'drop-shadow(0 0 42px rgba(56,217,245,0.22))',
      }}>
        <ThinkingOrb
          state={cfg.orb}
          size={64}
          theme="dark"
          color={cfg.color}
          style={{ width: '100%', height: '100%', display: 'block' }}
        />
      </div>
    </div>
  );
}
