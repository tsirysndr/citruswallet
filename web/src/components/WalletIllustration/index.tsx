export function WalletIllustration({
  variant = "create",
  className = "",
}: {
  variant?: "create" | "connect" | "ready";
  className?: string;
}) {
  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 280 180"
      className={className}
      fill="none"
    >
      <ellipse cx="140" cy="157" rx="83" ry="10" fill="#e7e5ef" />
      <circle cx="74" cy="57" r="32" fill="#d9d0fa" />
      <circle cx="219" cy="105" r="24" fill="#c5e6f7" />
      <path
        d="M45 104l5-9 5 9-5 9z"
        fill="#ffb1a2"
        stroke="#292d26"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path
        d="M221 36v12m-6-6h12M47 63v8m-4-4h8"
        stroke="#292d26"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <g transform="rotate(-8 140 90)">
        <rect
          x="79"
          y="48"
          width="125"
          height="96"
          rx="16"
          fill="#ffb995"
          stroke="#292d26"
          strokeWidth="2.5"
        />
        <path d="M81 68h120" stroke="#292d26" strokeWidth="2" />
        <rect
          x="100"
          y="32"
          width="77"
          height="40"
          rx="7"
          fill="#ffe5b3"
          stroke="#292d26"
          strokeWidth="2"
        />
        <path
          d="M112 45h35m-35 10h20"
          stroke="#292d26"
          strokeWidth="2"
          strokeLinecap="round"
        />
        <path
          d="M80 70h121v59a15 15 0 0 1-15 15H95a15 15 0 0 1-15-15z"
          fill="#ffb995"
          stroke="#292d26"
          strokeWidth="2.5"
        />
        <rect
          x="169"
          y="90"
          width="43"
          height="30"
          rx="9"
          fill="#faf9f5"
          stroke="#292d26"
          strokeWidth="2"
        />
        <circle cx="182" cy="105" r="3" fill="#292d26" />
        <path
          d="M101 122h25"
          stroke="#292d26"
          strokeWidth="2"
          strokeLinecap="round"
        />
      </g>
      {variant === "connect" ? (
        <g>
          <rect
            x="177"
            y="61"
            width="48"
            height="89"
            rx="11"
            fill="#b8dffc"
            stroke="#292d26"
            strokeWidth="2.5"
          />
          <path
            d="M193 68h16m-11 75h7"
            stroke="#292d26"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d="M194 98l7-7 8 8-8 9-5-5m-1-8-8 9 8 8 7-7"
            fill="none"
            stroke="#292d26"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : variant === "ready" ? (
        <g>
          <circle
            cx="203"
            cy="132"
            r="26"
            fill="#b7dff5"
            stroke="#292d26"
            strokeWidth="2.5"
          />
          <path
            d="M190 132l9 9 17-20"
            fill="none"
            stroke="#292d26"
            strokeWidth="3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </g>
      ) : (
        <g>
          <circle
            cx="202"
            cy="133"
            r="25"
            fill="#ffb1a2"
            stroke="#292d26"
            strokeWidth="2.5"
          />
          <path
            d="M202 120v26m-13-13h26"
            stroke="#292d26"
            strokeWidth="2.5"
            strokeLinecap="round"
          />
        </g>
      )}
    </svg>
  );
}
