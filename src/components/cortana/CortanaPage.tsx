import React, { lazy, Suspense } from 'react';
import { CortanaMoodProvider } from './CortanaMoodContext';

const CortanaLive = lazy(() => import('./CortanaLive'));
const CortanaControl = lazy(() => import('./CortanaControl'));

/**
 * CortanaPage — full-screen holographic companion shell.
 * Mounted only at /cortana (never global in App). Mood is shared via context.
 */
export function CortanaPage() {
  return (
    <CortanaMoodProvider>
      <Suspense fallback={<LoadingScreen />}>
        <CortanaLive />
        <CortanaControl />
      </Suspense>
    </CortanaMoodProvider>
  );
}

function LoadingScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        background: '#000',
        color: '#00ccff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: '"SF Mono", "Fira Code", monospace',
        fontSize: '14px',
        letterSpacing: '0.15em',
      }}
    >
      <div style={{ textAlign: 'center' }}>
        <div
          style={{
            width: 40,
            height: 40,
            border: '2px solid #00ccff33',
            borderTopColor: '#00ccff',
            borderRadius: '50%',
            animation: 'cortana-spin 1s linear infinite',
            margin: '0 auto 16px',
          }}
        />
        INITIALIZING CORTANA
      </div>
      <style>{`@keyframes cortana-spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  );
}

export default CortanaPage;
