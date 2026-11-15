import { useEffect } from 'react';
import { useNavigate } from 'react-router';

/**
 * After back/forward cache restore, React Router state can desync from the visible URL.
 * Re-applying the current location forces the router tree to reconcile with the address bar.
 */
export function BfcacheRouterSync() {
  const navigate = useNavigate();

  useEffect(() => {
    const onPageShow = (e: PageTransitionEvent) => {
      if (!e.persisted) return;
      const { pathname, search, hash } = window.location;
      navigate(`${pathname}${search}${hash}`, { replace: true });
    };
    window.addEventListener('pageshow', onPageShow);
    return () => window.removeEventListener('pageshow', onPageShow);
  }, [navigate]);

  return null;
}

/**
 * Automatically routes native Capacitor iOS app launches or mobile standalone home-screen opens
 * directly to /cortex/mobile if landing on root.
 */
export function CapacitorRouterSync() {
  const navigate = useNavigate();

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const isExplicitWeb = window.location.search.includes('view=web');
    if (isExplicitWeb) return;

    const isCapacitor = !!(window as any).Capacitor?.isNativePlatform?.() ||
      (window as any).Capacitor?.getPlatform?.() === 'ios' ||
      (window as any).Capacitor?.platform === 'ios' ||
      window.location.protocol === 'cortex:' ||
      window.location.protocol === 'capacitor:' ||
      window.location.protocol === 'ionic:';

    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone === true;
    const isMobileLanding = window.location.search.includes('platform=mobile') || window.location.search.includes('cortex');

    const isRoot = window.location.pathname === '/' || window.location.pathname === '' || window.location.pathname === '/index.html';

    if ((isCapacitor || isStandalone || isMobileLanding) && isRoot) {
      navigate('/cortex/mobile', { replace: true });
    }
  }, [navigate]);

  return null;
}
