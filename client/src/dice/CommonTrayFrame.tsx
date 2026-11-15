import { useId } from 'react';

/** Aro vetorial compartilhado: bordas nítidas em qualquer densidade de tela. */
export function CommonTrayFrame() {
  const id = `dice-frame-${useId().replace(/:/g, '')}`;
  return (
    <svg className="dice-common-frame" viewBox="0 0 400 400" aria-hidden="true" focusable="false">
      <defs>
        <linearGradient id={`${id}-metal`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#735022" />
          <stop offset="0.2" stopColor="#f4d591" />
          <stop offset="0.37" stopColor="#ac7a32" />
          <stop offset="0.53" stopColor="#63431f" />
          <stop offset="0.72" stopColor="#d7ad60" />
          <stop offset="0.89" stopColor="#f1d18a" />
          <stop offset="1" stopColor="#795125" />
        </linearGradient>
        <linearGradient id={`${id}-light`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffe9b6" />
          <stop offset="0.48" stopColor="#be914c" />
          <stop offset="1" stopColor="#e5c886" />
        </linearGradient>
      </defs>
      <circle cx="200" cy="200" r="195" fill="none" stroke="#1c140d" strokeWidth="3" />
      <circle cx="200" cy="200" r="188" fill="none" stroke={`url(#${id}-metal)`} strokeWidth="13" />
      <circle cx="200" cy="200" r="194.4" fill="none" stroke={`url(#${id}-light)`} strokeWidth="0.9" />
      <circle cx="200" cy="200" r="191.5" fill="none" stroke="#f4d896" strokeOpacity="0.34" strokeWidth="0.7" />
      <circle cx="200" cy="200" r="184.2" fill="none" stroke="#4e351b" strokeWidth="1.2" />
      <circle cx="200" cy="200" r="181.2" fill="none" stroke={`url(#${id}-light)`} strokeWidth="1.3" />
      <circle cx="200" cy="200" r="179.5" fill="none" stroke="#17110d" strokeWidth="2" />
      {[0, 90, 180, 270].map(angle => (
        <g key={angle} transform={`rotate(${angle} 200 200)`}>
          <path d="M200 3 204 11 211 15 204 19 200 29 196 19 189 15 196 11Z" fill={`url(#${id}-metal)`} stroke="#563819" strokeWidth="0.7" />
          <path d="M200 6 201.8 13 207 15 201.8 17 200 25 198.2 17 193 15 198.2 13Z" fill="#e8c77d" />
          <path d="M200 9 201.2 15 200 22 198.8 15Z" fill="#805824" />
        </g>
      ))}
      {[45, 135, 225, 315].map(angle => (
        <g key={angle} transform={`rotate(${angle} 200 200)`}>
          <circle cx="200" cy="12" r="2.2" fill="#65441e" />
          <circle cx="200" cy="11.6" r="1.3" fill="#e2bf77" />
        </g>
      ))}
    </svg>
  );
}
