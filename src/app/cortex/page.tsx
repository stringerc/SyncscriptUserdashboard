"use client";

import { useEffect, useState } from "react";

export default function CortexPage() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <div style={{ minHeight: '100vh', background: 'black', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'white' }}>
        <div style={{ fontFamily: 'monospace', fontSize: '1.25rem', color: '#00D6FF' }}>INITIALIZING CORTEX...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', background: 'black', color: 'white', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <section style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '2rem', position: 'relative', overflow: 'hidden' }}>
        <div style={{ position: 'absolute', inset: 0, background: 'linear-gradient(to bottom, black, #0a0a0a, black)' }} />
        
        <div style={{ position: 'relative', zIndex: 10, maxWidth: '800px', textAlign: 'center', padding: '2rem' }}>
          <div style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: '88px',
            height: '88px',
            borderRadius: '22px',
            background: 'linear-gradient(135deg, rgba(0,80,255,0.15) 0%, rgba(0,214,255,0.08) 100%)',
            border: '1px solid rgba(0,80,255,0.15)',
            marginBottom: '2rem',
            backdropFilter: 'blur(20px)',
            fontSize: '2.75rem'
          }}>
            ⟲
          </div>
          
          <h1 style={{
            fontSize: 'clamp(2.75rem, 7vw, 5.5rem)',
            fontWeight: 700,
            lineHeight: 1.02,
            letterSpacing: '-0.035em',
            color: 'white',
            marginBottom: '1.5rem',
            background: 'linear-gradient(180deg, #0050FF 0%, #00D6FF 50%, #10B981 100%)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
            backgroundClip: 'text',
          }}>
            Cortex
          </h1>
          
          <p style={{
            fontSize: 'clamp(1.125rem, 2.5vw, 1.5rem)',
            fontWeight: 400,
            lineHeight: 1.65,
            color: '#888',
            maxWidth: '720px',
            margin: '0 auto 3rem',
            letterSpacing: '-0.01em',
          }}>
            SyncScript's Conscious AI Co-Pilot — Executive Host Agent. Cortana persona. Real-time neural bridge between human intent and machine execution.
          </p>
          
          <div style={{
            display: 'flex',
            flexWrap: 'wrap',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '1.5rem',
            marginBottom: '3rem',
            padding: '1.5rem 2rem',
            background: 'rgba(10, 10, 12, 0.6)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '1rem',
            backdropFilter: 'blur(20px)',
          }}>
            <div style={{ textAlign: 'center', minWidth: '100px' }}>
              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                fontWeight: 700,
                color: 'white',
                lineHeight: 1.1,
                marginBottom: '0.25rem',
              }}>GWT + IIT 4.0</div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                fontFamily: 'monospace',
                color: '#00D6FF',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>Consciousness</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '100px' }}>
              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                fontWeight: 700,
                color: 'white',
                lineHeight: 1.1,
                marginBottom: '0.25rem',
              }}>Multi-Agent</div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                fontFamily: 'monospace',
                color: '#00D6FF',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>Orchestration</div>
            </div>
            <div style={{ textAlign: 'center', minWidth: '100px' }}>
              <div style={{
                fontSize: 'clamp(1.5rem, 3vw, 2.25rem)',
                fontWeight: 700,
                color: 'white',
                lineHeight: 1.1,
                marginBottom: '0.25rem',
              }}>4 Channels</div>
              <div style={{
                fontSize: '0.75rem',
                fontWeight: 500,
                fontFamily: 'monospace',
                color: '#00D6FF',
                textTransform: 'uppercase',
                letterSpacing: '0.05em',
              }}>I/O</div>
            </div>
          </div>
          
          <a href="#neural-link" style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '0.75rem',
            padding: '1.125rem 2.75rem',
            borderRadius: '1rem',
            fontSize: '1.0625rem',
            fontWeight: 600,
            color: '#fff',
            textDecoration: 'none',
            background: 'linear-gradient(135deg, #0050FF 0%, #00D6FF 100%)',
            border: '1px solid rgba(255,255,255,0.1)',
            boxShadow: '0 8px 32px rgba(0, 80, 255, 0.3), inset 0 1px 0 rgba(255,255,255,0.1)',
            transition: 'all 0.2s ease',
          }}>
            Open Neural Link
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </a>
        </div>
      </section>

      <section id="neural-link" style={{ padding: '6rem 2rem', background: '#0a0a0a' }}>
        <div style={{ maxWidth: '1200px', margin: '0 auto' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem', marginBottom: '4rem' }}>
            <StatusCard
              label="Consciousness Bridge"
              desc="Global Workspace Theory + IIT 4.0 + Active Inference. Real-time awareness state synchronized across sessions."
              href="/api/cortex/consciousness"
            />
            <StatusCard
              label="Active Missions"
              desc="Task delegation, sub-agent orchestration, multi-step workflows with autonomous completion tracking."
              href="/api/cortex/missions"
            />
            <StatusCard
              label="Neural Channels"
              desc="Telegram, WebChat, Discord, iMessage, Voice. Multi-modal I/O with TTS/STT pipeline."
              href="/api/cortex/channels"
            />
          </div>

          <div style={{ borderTop: '1px solid #1f1f1f', paddingTop: '3rem' }}>
            <h2 style={{ fontSize: '1.5rem', fontWeight: 700, marginBottom: '2rem', textAlign: 'center' }}>System Status</h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.5rem' }}>
              <SystemCard label="Gateway" value="OPERATIONAL" status="online" port="18789" />
              <SystemCard label="Gemini Proxy" value="OPERATIONAL" status="online" port="18790" />
              <SystemCard label="Mistral Proxy" value="OPERATIONAL" status="online" port="18791" />
              <SystemCard label="Kimi Proxy" value="OPERATIONAL" status="online" port="18792" />
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function StatusCard({ label, desc, href }: { label: string; desc: string; href: string }) {
  return (
    <a href={href} style={{ textDecoration: 'none', color: 'inherit' }}>
      <div style={{
        background: 'rgba(10, 10, 12, 0.8)',
        border: '1px solid #2a2a2a',
        borderRadius: '1rem',
        padding: '2rem',
        transition: 'border-color 0.2s',
      }} onMouseEnter={(e) => e.currentTarget.style.borderColor = '#00D6FF'} onMouseLeave={(e) => e.currentTarget.style.borderColor = '#2a2a2a'}>
        <h3 style={{ fontSize: '1.25rem', fontWeight: 600, color: '#00D6FF', marginBottom: '1rem' }}>{label}</h3>
        <p style={{ color: '#888', marginBottom: '1.5rem', lineHeight: 1.6 }}>{desc}</p>
        <span style={{ color: '#00D6FF', fontSize: '0.875rem', fontWeight: 500 }}>View Details →</span>
      </div>
    </a>
  );
}

function SystemCard({ label, value, status, port }: { label: string; value: string; status: "online" | "offline"; port: number }) {
  return (
    <div style={{
      background: 'rgba(10, 10, 12, 0.8)',
      border: '1px solid #2a2a2a',
      borderRadius: '1rem',
      padding: '1.5rem',
      textAlign: 'center',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.5rem' }}>
        <span style={{ width: '12px', height: '12px', borderRadius: '50%', background: status === "online" ? '#10B981' : '#EF4444' }} />
        <span style={{ fontSize: '0.75rem', fontFamily: 'monospace', color: '#666' }}>: {port}</span>
      </div>
      <p style={{ fontSize: '2rem', fontWeight: 700, color: '#00D6FF', marginBottom: '0.25rem' }}>{value}</p>
      <p style={{ fontSize: '0.875rem', color: '#666' }}>{label}</p>
    </div>
  );
}