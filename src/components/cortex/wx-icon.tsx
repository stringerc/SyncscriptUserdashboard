/**
 * wx-icon — shared animated SVG weather glyph + condition classifier.
 *
 * Extracted from ArtifactRenderer so WeatherCard (modal + pinned panel)
 * and any future weather surface share one icon set. Animations come from
 * the cx-wxi-* keyframes — consumers must include WX_ICON_CSS once.
 */

export const WX_ICON_CSS = `
  @keyframes cx-wxi-rays-spin { to { transform: rotate(360deg); } }
  .cx-wxi-rays { transform-box: fill-box; transform-origin: center; animation: cx-wxi-rays-spin 26s linear infinite; }
  .cx-wxi-twinkle { animation: cx-wxi-tw 2.6s ease-in-out infinite; }
  @keyframes cx-wxi-tw { 0%,100% { opacity: 0.25; } 50% { opacity: 1; } }
  .cx-wxi-drop { animation: cx-wxi-fall 1.15s linear infinite; }
  @keyframes cx-wxi-fall { 0% { transform: translateY(-2px); opacity: 0; } 25% { opacity: 1; } 100% { transform: translateY(5px); opacity: 0; } }
  .cx-wxi-flake { animation: cx-wxi-flake 2.4s ease-in-out infinite; }
  @keyframes cx-wxi-flake { 0%,100% { transform: translate(0,0); } 50% { transform: translate(1.6px,-2.2px); } }
  .cx-wxi-bolt { animation: cx-wxi-bolt 3.8s linear infinite; }
  @keyframes cx-wxi-bolt { 0%,55%,100% { opacity: 0; } 58% { opacity: 1; } 62% { opacity: 0.2; } 66% { opacity: 1; } 70% { opacity: 0; } }
  .cx-wxi-fogline { animation: cx-wxi-fogx 3.4s ease-in-out infinite alternate; }
  @keyframes cx-wxi-fogx { from { transform: translateX(-1.6px); } to { transform: translateX(1.6px); } }
  @media (prefers-reduced-motion: reduce) {
    .cx-wxi-rays, .cx-wxi-twinkle, .cx-wxi-drop, .cx-wxi-flake, .cx-wxi-bolt, .cx-wxi-fogline { animation: none !important; }
  }
`;

export function WxIcon({ k, size = 46 }: { k: string; size?: number }) {
  const cloud = 'M7 18.6a4.6 4.6 0 0 1-.42-9.18A6.1 6.1 0 0 1 18.4 8.7a4.3 4.3 0 0 1-.7 9.9H7z';
  const rays = Array.from({ length: 8 }, (_, i) => {
    const a = (i * Math.PI) / 4;
    const x1 = 12 + Math.cos(a) * 6.6, y1 = 12 + Math.sin(a) * 6.6;
    const x2 = 12 + Math.cos(a) * 8.6, y2 = 12 + Math.sin(a) * 8.6;
    return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />;
  });
  const miniSun = (
    <g>
      <g className="cx-wxi-rays" stroke="#ffd76a" strokeWidth="1.1" strokeLinecap="round" opacity="0.85">
        {Array.from({ length: 6 }, (_, i) => {
          const a = (i * Math.PI) / 3 + 0.5;
          return <line key={i} x1={17.6 + Math.cos(a) * 3.1} y1={6.4 + Math.sin(a) * 3.1} x2={17.6 + Math.cos(a) * 4.1} y2={6.4 + Math.sin(a) * 4.1} />;
        })}
      </g>
      <circle cx="17.6" cy="6.4" r="2.4" fill="#ffd76a" />
    </g>
  );
  const miniMoon = (
    <g>
      <path d="M19.5 5.6A5.4 5.4 0 0 1 18.4 9.4 5.4 5.4 0 1 0 19.5 5.6z" fill="#dfe8ff" />
      <circle cx="8.6" cy="5.2" r="0.55" fill="#fff" className="cx-wxi-twinkle" />
      <circle cx="20.4" cy="11.6" r="0.45" fill="#fff" className="cx-wxi-twinkle" style={{ animationDelay: '1.2s' }} />
    </g>
  );
  const drops = (
    <g stroke="#8fd0ff" strokeWidth="1.5" strokeLinecap="round">
      <line className="cx-wxi-drop" x1="8.6" y1="18.4" x2="7.9" y2="21" style={{ animationDelay: '0s' }} />
      <line className="cx-wxi-drop" x1="12" y1="18.8" x2="11.3" y2="21.4" style={{ animationDelay: '0.35s' }} />
      <line className="cx-wxi-drop" x1="15.4" y1="18.4" x2="14.7" y2="21" style={{ animationDelay: '0.7s' }} />
    </g>
  );
  const flakes = (
    <g fill="#eef6ff">
      <circle className="cx-wxi-flake" cx="8.6" cy="19.4" r="0.85" style={{ animationDelay: '0s' }} />
      <circle className="cx-wxi-flake" cx="12" cy="20" r="0.7" style={{ animationDelay: '0.6s' }} />
      <circle className="cx-wxi-flake" cx="15.4" cy="19.4" r="0.85" style={{ animationDelay: '1.1s' }} />
    </g>
  );
  const fogLines = (
    <g stroke="#b8cfe4" strokeWidth="1.4" strokeLinecap="round">
      <line className="cx-wxi-fogline" x1="7.4" y1="19.2" x2="16.6" y2="19.2" style={{ animationDelay: '0s' }} />
      <line className="cx-wxi-fogline" x1="9" y1="21" x2="15" y2="21" style={{ animationDelay: '0.9s' }} />
    </g>
  );
  const bolt = (
    <path className="cx-wxi-bolt" d="M13.4 13.2 10.9 17.6h2.3l-1.5 3.6 3.6-4.8h-2.3l1.4-3.2z" fill="#fde047" />
  );
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" style={{ display: 'block', flexShrink: 0 }}>
      {k === 'sun' && (
        <g>
          <g className="cx-wxi-rays" stroke="#ffd76a" strokeWidth="1.5" strokeLinecap="round">{rays}</g>
          <circle cx="12" cy="12" r="4.2" fill="#ffd76a" />
        </g>
      )}
      {k === 'moon' && (
        <g>
          <path d="M20 13.4A8.4 8.4 0 0 1 10.6 4 8.4 8.4 0 1 0 20 13.4z" fill="#dfe8ff" />
          <circle cx="17.6" cy="4.6" r="0.6" fill="#fff" className="cx-wxi-twinkle" />
          <circle cx="5.4" cy="8.8" r="0.5" fill="#fff" className="cx-wxi-twinkle" style={{ animationDelay: '1.4s' }} />
          <circle cx="19.8" cy="17.8" r="0.45" fill="#fff" className="cx-wxi-twinkle" style={{ animationDelay: '0.7s' }} />
        </g>
      )}
      {k === 'partly-day' && <g>{miniSun}<path d={cloud} fill="#cfe0f5" /></g>}
      {k === 'partly-night' && <g>{miniMoon}<path d={cloud} fill="#aebfd8" /></g>}
      {k === 'cloud' && <path d={cloud} fill="#cfe0f5" />}
      {k === 'rain' && <g><path d={cloud} fill="#b9cbe2" />{drops}</g>}
      {k === 'snow' && <g><path d={cloud} fill="#c8d8ec" />{flakes}</g>}
      {k === 'storm' && <g><path d={cloud} fill="#9fb2cc" />{bolt}{drops}</g>}
      {k === 'fog' && <g><path d={cloud} fill="#bccadb" opacity="0.85" />{fogLines}</g>}
    </svg>
  );
}

export function wxCondKey(cond?: string): 'storm' | 'snow' | 'rain' | 'fog' | 'cloud' | 'partly' | 'sun' {
  const c = (cond || '').toLowerCase();
  if (/thunder|storm|lightning/.test(c)) return 'storm';
  if (/snow|flurr|sleet|wintry|blizzard/.test(c)) return 'snow';
  if (/rain|shower|drizzle|precip/.test(c)) return 'rain';
  if (/fog|haze|mist|smoky/.test(c)) return 'fog';
  if (/overcast|cloudy|mostly cloudy/.test(c)) return 'cloud';
  if (/partly|mostly clear|mostly sunny/.test(c)) return 'partly';
  return 'sun';
}
