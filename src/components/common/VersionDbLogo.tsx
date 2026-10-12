import React from 'react';

interface VersionDbLogoProps {
  size?: number;
  className?: string;
}

export const VersionDbLogo: React.FC<VersionDbLogoProps> = ({ size = 28, className = '' }) => {
  return (
    <div
      className={`inline-flex items-center justify-center rounded-lg bg-slate-900 text-white shadow-xs shrink-0 select-none ${className}`}
      style={{ width: size, height: size }}
      aria-label="VersionDB Logo"
    >
      <svg
        width={Math.round(size * 0.65)}
        height={Math.round(size * 0.65)}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <ellipse cx="12" cy="5" rx="9" ry="3" />
        <path d="M3 5v14c0 1.66 4.03 3 9 3s9-1.34 9-3V5" />
        <path d="M3 12c0 1.66 4.03 3 9 3s9-1.34 9-3" />
        <circle cx="16" cy="12" r="2" fill="currentColor" />
        <path d="M12 8v4" />
      </svg>
    </div>
  );
};
