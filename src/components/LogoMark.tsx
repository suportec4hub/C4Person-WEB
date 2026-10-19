import React from "react";

interface LogoMarkProps {
  size?: number;
  className?: string;
}

export function LogoMark({ size = 36, className = "" }: LogoMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="C4Person"
      className={className}
    >
      <defs>
        <linearGradient id="lmg" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%"   stopColor="#3730a3"/>
          <stop offset="52%"  stopColor="#7c3aed"/>
          <stop offset="100%" stopColor="#c026d3"/>
        </linearGradient>
        <radialGradient id="lml" cx="38%" cy="30%" r="60%">
          <stop offset="0%"   stopColor="#ffffff" stopOpacity=".18"/>
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0"/>
        </radialGradient>
        <clipPath id="lmrr">
          <rect width="100" height="100" rx="22"/>
        </clipPath>
      </defs>
      <g clipPath="url(#lmrr)">
        <rect width="100" height="100" fill="url(#lmg)"/>
        <rect width="100" height="100" fill="url(#lml)"/>
        <path d="M 43.9,59.7 A 17,17 0 1 0 43.9,40.3"
              stroke="#fff" strokeWidth="9" fill="none" strokeLinecap="round"/>
        <line x1="69" y1="22" x2="69" y2="78" stroke="#fff" strokeWidth="9" strokeLinecap="round"/>
        <line x1="69" y1="22" x2="52" y2="57" stroke="#fff" strokeWidth="9" strokeLinecap="round"/>
        <line x1="48" y1="57" x2="73" y2="57" stroke="#fff" strokeWidth="9" strokeLinecap="round"/>
        <polygon points="50,74 53.5,78 50,82 46.5,78" fill="#fff" opacity=".45"/>
      </g>
    </svg>
  );
}
