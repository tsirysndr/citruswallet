import { useId } from "react";

export function PeachletMark({ className }: { className?: string }) {
  const id = useId();
  return (
    <svg
      className={className}
      viewBox="0 0 48 48"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient
          id={`${id}-flesh`}
          x1="10"
          y1="8"
          x2="37"
          y2="42"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#ffe1af" />
          <stop offset="1" stopColor="#f5ac80" />
        </linearGradient>
        <linearGradient
          id={`${id}-pit`}
          x1="20"
          y1="16"
          x2="29"
          y2="32"
          gradientUnits="userSpaceOnUse"
        >
          <stop stopColor="#925536" />
          <stop offset="1" stopColor="#633720" />
        </linearGradient>
      </defs>
      <circle
        cx="24"
        cy="24"
        r="20"
        fill={`url(#${id}-flesh)`}
        stroke="#ef7045"
        strokeWidth="1.2"
      />
      <path
        d="M12 25c-1-5 1-10 5-12"
        stroke="#fff0cf"
        strokeWidth="1.5"
        strokeLinecap="round"
        opacity=".7"
      />
      <path
        d="M33 31c-1 3-3 5-6 6"
        stroke="#d98e68"
        strokeWidth="1.2"
        strokeLinecap="round"
        opacity=".4"
      />
      <g transform="rotate(20 24 24)">
        <ellipse cx="24" cy="24" rx="6" ry="8" fill={`url(#${id}-pit)`} />
        <path
          d="M23 19c-2 3 1 6-1 9M26 22c-1 2 1 4 0 6"
          stroke="#c18c62"
          strokeWidth="1"
          strokeLinecap="round"
          opacity=".55"
        />
      </g>
    </svg>
  );
}
