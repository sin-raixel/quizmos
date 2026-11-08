// The Quizmos mark: a ringed planet with a question mark on its face, and a spark of "aha".
// Pointing at the logo (anything with the .logo class around it) tilts the planet and spins the spark.
export default function Logo({ className = "size-10" }: { className?: string }) {
  return (
    <svg viewBox="0 0 64 64" fill="none" aria-hidden="true" className={`logo-mark ${className}`}>
      <defs>
        <radialGradient id="qz-planet" cx="34%" cy="28%" r="80%">
          <stop offset="0" stopColor="#ddd6fe" />
          <stop offset="0.45" stopColor="#8b5cf6" />
          <stop offset="1" stopColor="#4c1d95" />
        </radialGradient>
        <linearGradient id="qz-ring" x1="3" y1="32" x2="61" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0" stopColor="#7dd3fc" />
          <stop offset="0.5" stopColor="#a78bfa" />
          <stop offset="1" stopColor="#7dd3fc" />
        </linearGradient>
      </defs>
      <path transform="rotate(-24 32 32)" d="M3.5 32A28.5 8.5 0 0 1 60.5 32" stroke="url(#qz-ring)" strokeWidth="3.4" strokeLinecap="round" />
      <circle cx="32" cy="32" r="17.5" fill="url(#qz-planet)" />
      <g transform="translate(32 28) scale(0.88) translate(-32 -28) translate(0 -4)" stroke="#fff" strokeLinecap="round" strokeLinejoin="round">
        <path d="M26.6 28.4c0-3.2 2.4-5.2 5.5-5.2 3 0 5.3 1.9 5.3 4.7 0 3.7-5.3 4.1-5.3 7.8" strokeWidth="3.6" />
        <circle cx="32.1" cy="40.4" r="2.1" fill="#fff" stroke="none" />
      </g>
      <path transform="rotate(-24 32 32)" d="M3.5 32A28.5 8.5 0 0 0 60.5 32" stroke="url(#qz-ring)" strokeWidth="3.4" strokeLinecap="round" />
      <path className="logo-spark" d="M11 5.5l1.6 4.4 4.4 1.6-4.4 1.6L11 17.5l-1.6-4.4L5 11.5l4.4-1.6z" fill="#fff" />
    </svg>
  );
}
