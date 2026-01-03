export default function Logo({ size = 32 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 64 64"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Background circle */}
      <circle cx="32" cy="32" r="30" fill="url(#gradient)" />
      
      {/* Chart lines */}
      <path
        d="M12 40 L20 32 L28 24 L36 28 L44 20 L52 16"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
      
      {/* Crypto symbol (BTC-style) */}
      <circle cx="32" cy="32" r="12" stroke="white" strokeWidth="2" fill="none" opacity="0.3" />
      <path
        d="M26 28 L32 24 L38 28 L36 32 L32 30 L28 32 Z"
        fill="white"
        opacity="0.8"
      />
      
      {/* Gradient definition */}
      <defs>
        <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#667eea" />
          <stop offset="100%" stopColor="#764ba2" />
        </linearGradient>
      </defs>
    </svg>
  );
}

