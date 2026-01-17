import type { FC } from 'react';

export const Logo: FC<{ size?: number }> = ({ size = 36 }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        {/* Gradiente principal - Emerald */}
        <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#10b981" />
          <stop offset="50%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>

        {/* Gradiente para el brillo */}
        <linearGradient id="glowGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="#34d399" />
          <stop offset="100%" stopColor="#6ee7b7" />
        </linearGradient>

        {/* Sombra suave */}
        <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
          <feGaussianBlur stdDeviation="1" result="blur" />
          <feMerge>
            <feMergeNode in="blur" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>

      {/* Fondo hexagonal */}
      <path
        d="M20 2L36 11V29L20 38L4 29V11L20 2Z"
        fill="url(#logoGradient)"
        opacity="0.15"
      />

      {/* Borde hexagonal */}
      <path
        d="M20 2L36 11V29L20 38L4 29V11L20 2Z"
        fill="none"
        stroke="url(#logoGradient)"
        strokeWidth="1.5"
        opacity="0.6"
      />

      {/* Cabeza del bot - forma principal */}
      <rect
        x="11"
        y="13"
        width="18"
        height="14"
        rx="3"
        fill="url(#logoGradient)"
        filter="url(#softGlow)"
      />

      {/* Antena */}
      <path
        d="M20 13V8"
        stroke="url(#glowGradient)"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle
        cx="20"
        cy="6"
        r="2"
        fill="url(#glowGradient)"
      />

      {/* Ojos - estilo moderno */}
      <rect
        x="14"
        y="17"
        width="4"
        height="5"
        rx="1.5"
        fill="#212121"
        opacity="0.8"
      />
      <rect
        x="22"
        y="17"
        width="4"
        height="5"
        rx="1.5"
        fill="#212121"
        opacity="0.8"
      />

      {/* Brillo en los ojos */}
      <circle cx="15" cy="18" r="1" fill="white" opacity="0.8" />
      <circle cx="23" cy="18" r="1" fill="white" opacity="0.8" />

      {/* Orejas/Conectores laterales */}
      <rect
        x="6"
        y="18"
        width="4"
        height="4"
        rx="1"
        fill="url(#glowGradient)"
      />
      <rect
        x="30"
        y="18"
        width="4"
        height="4"
        rx="1"
        fill="url(#glowGradient)"
      />

      {/* Línea de conexión - estilo circuito */}
      <path
        d="M8 22V26H14"
        stroke="url(#glowGradient)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
      <path
        d="M32 22V26H26"
        stroke="url(#glowGradient)"
        strokeWidth="1"
        strokeLinecap="round"
        opacity="0.5"
      />
    </svg>
  );
};
