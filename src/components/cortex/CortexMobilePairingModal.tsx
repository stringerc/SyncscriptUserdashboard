/**
 * Cortex Mobile Pairing Modal with Dynamic QR Code Generation
 * Scannable from iPhone Camera for Instant Pairing
 */

import React, { useState, useEffect } from 'react';
import QRCode from 'qrcode';
import { Smartphone, Check, Copy, Wifi, Cloud, ShieldCheck, X, ArrowUpRight } from 'lucide-react';
import type { MobilePairingPayload } from '../../lib/cortex-mobile-sync';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export function CortexMobilePairingModal({ isOpen, onClose }: Props) {
  const [pairingPayload, setPairingPayload] = useState<MobilePairingPayload | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string>('');
  const [copied, setCopied] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!isOpen) return;
    setIsLoading(true);

    fetch('/api/cortex/mobile/pairing')
      .then(r => r.json())
      .then(async (data) => {
        if (data?.ok && data.payload) {
          setPairingPayload(data.payload);
          const companionUrl = `${data.payload.hostUrl}/cortex/mobile`;
          try {
            const qr = await QRCode.toDataURL(companionUrl, {
              width: 240,
              margin: 1,
              color: {
                dark: '#0f172a',
                light: '#ffffff',
              },
            });
            setQrDataUrl(qr);
          } catch (qrErr) {
            console.error('QR generation error:', qrErr);
          }
        }
      })
      .catch((err) => console.error('Failed to load pairing info:', err))
      .finally(() => setIsLoading(false));
  }, [isOpen]);

  if (!isOpen) return null;

  const targetUrl = pairingPayload ? `${pairingPayload.hostUrl}/cortex/mobile` : '';

  const handleCopy = () => {
    if (!targetUrl) return;
    navigator.clipboard.writeText(targetUrl).catch(() => {});
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      id="cortex-mobile-pairing-modal-overlay"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(10px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 20,
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        id="cortex-mobile-pairing-card"
        style={{
          width: '100%',
          maxWidth: 460,
          background: '#090d16',
          borderRadius: 16,
          border: '1px solid rgba(0, 204, 255, 0.35)',
          padding: 24,
          boxShadow: '0 25px 60px rgba(0, 0, 0, 0.8), 0 0 30px rgba(0, 204, 255, 0.15)',
          position: 'relative',
          color: '#f8fafc',
          fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Inter", sans-serif',
        }}
      >
        {/* Close Button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: 16,
            right: 16,
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: 4,
          }}
        >
          <X size={18} />
        </button>

        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
          <div
            style={{
              width: 38,
              height: 38,
              borderRadius: 12,
              background: 'linear-gradient(135deg, #00ccff 0%, #8b5cf6 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 14px rgba(0, 204, 255, 0.4)',
            }}
          >
            <Smartphone size={20} color="#ffffff" />
          </div>
          <div>
            <div style={{ fontSize: 16, fontWeight: 700, letterSpacing: '-0.02em' }}>
              Pair iPhone with Cortex
            </div>
            <div style={{ fontSize: 11, color: '#94a3b8' }}>
              Access MEMORY.md on your phone even when laptop is powered off
            </div>
          </div>
        </div>

        {/* QR Code Container */}
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(255, 255, 255, 0.03)',
            borderRadius: 12,
            border: '1px solid rgba(255, 255, 255, 0.08)',
            padding: 16,
            marginBottom: 16,
          }}
        >
          {isLoading ? (
            <div style={{ padding: '40px 0', fontSize: 12, color: '#94a3b8' }}>
              Generating secure pairing configuration…
            </div>
          ) : qrDataUrl ? (
            <>
              <div
                style={{
                  background: '#ffffff',
                  padding: 10,
                  borderRadius: 10,
                  boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
                  marginBottom: 10,
                }}
              >
                <img
                  id="mobile-pairing-qr-img"
                  src={qrDataUrl}
                  alt="Scan with iPhone Camera"
                  style={{ width: 190, height: 190, display: 'block' }}
                />
              </div>
              <div style={{ fontSize: 11, color: '#38bdf8', fontWeight: 600 }}>
                Point your iPhone Camera at this code to open
              </div>
            </>
          ) : (
            <div style={{ color: '#f87171', fontSize: 12 }}>Unable to generate QR code</div>
          )}
        </div>

        {/* URL Copy Row */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '8px 12px',
            borderRadius: 8,
            background: 'rgba(30, 41, 59, 0.5)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            marginBottom: 16,
          }}
        >
          <span style={{ fontSize: 11, color: '#94a3b8', flex: 1, fontFamily: 'monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
            {targetUrl || 'Loading…'}
          </span>
          <button
            id="mobile-pairing-copy-url-btn"
            onClick={handleCopy}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 4,
              padding: '4px 10px',
              borderRadius: 6,
              background: copied ? 'rgba(16, 185, 129, 0.2)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${copied ? '#34d399' : 'rgba(255, 255, 255, 0.15)'}`,
              color: copied ? '#34d399' : '#e2e8f0',
              fontSize: 11,
              cursor: 'pointer',
            }}
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            <span>{copied ? 'Copied' : 'Copy URL'}</span>
          </button>
        </div>

        {/* 3-Tier Architecture Assurance Badges */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#cbd5e1' }}>
            <Wifi size={14} className="text-emerald-400 shrink-0" />
            <span><strong>Tier 1:</strong> Direct LAN/WireGuard connection to Mac when on.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#cbd5e1' }}>
            <Cloud size={14} className="text-purple-400 shrink-0" />
            <span><strong>Tier 2:</strong> Private GitHub sync when laptop battery dies.</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 11, color: '#cbd5e1' }}>
            <ShieldCheck size={14} className="text-amber-400 shrink-0" />
            <span><strong>Tier 3:</strong> Encrypted on-device cache for offline airplane mode.</span>
          </div>
        </div>

        {/* Open Standalone Preview in new tab */}
        <div style={{ marginTop: 16, paddingTop: 14, borderTop: '1px solid rgba(255, 255, 255, 0.08)', display: 'flex', justifyContent: 'flex-end' }}>
          <a
            id="mobile-preview-open-link"
            href="/cortex/mobile"
            target="_blank"
            rel="noopener noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 12,
              fontWeight: 600,
              color: '#38bdf8',
              textDecoration: 'none',
            }}
          >
            <span>Open Mobile View Preview</span>
            <ArrowUpRight size={14} />
          </a>
        </div>
      </div>
    </div>
  );
}
