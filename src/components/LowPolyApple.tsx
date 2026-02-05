import { useId } from "react";

/**
 * Manzana low-poly hecha solo con vértices y aristas (wireframe).
 * Pensada para fondo del login.
 */
export function LowPolyApple({ className = "" }: { className?: string }) {
  const id = useId().replace(/:/g, "-");
  return (
    <svg
      viewBox="0 0 200 240"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden
    >
      <defs>
        <linearGradient id={`lowpoly-apple-fill-${id}`} x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stopColor="currentColor" stopOpacity="0.12" />
          <stop offset="100%" stopColor="currentColor" stopOpacity="0.04" />
        </linearGradient>
      </defs>
      {/* Cuerpo: triángulos desde el centro = puros vértices */}
      <g stroke="currentColor" strokeOpacity="0.55" strokeWidth="0.65" fill={`url(#lowpoly-apple-fill-${id})`}>
        <polygon points="100,92 68,22 84,38" />
        <polygon points="100,92 84,38 94,56" />
        <polygon points="100,92 94,56 100,72" />
        <polygon points="100,92 100,72 101,88" />
        <polygon points="100,92 101,88 94,102" />
        <polygon points="100,92 94,102 78,106" />
        <polygon points="100,92 78,106 60,96" />
        <polygon points="100,92 60,96 54,78" />
        <polygon points="100,92 54,78 50,56" />
        <polygon points="100,92 50,56 56,36" />
        <polygon points="100,92 56,36 68,22" />
        <polygon points="100,92 68,22 106,26" />
        <polygon points="100,92 106,26 120,40" />
        <polygon points="100,92 120,40 126,60" />
        <polygon points="100,92 126,60 123,84" />
        <polygon points="100,92 123,84 113,98" />
        <polygon points="100,92 113,98 94,102" />
      </g>
      {/* Aristas: refuerzo de la malla de vértices */}
      <g stroke="currentColor" strokeOpacity="0.6" strokeWidth="0.55" fill="none">
        <line x1="100" y1="92" x2="68" y2="22" />
        <line x1="100" y1="92" x2="84" y2="38" />
        <line x1="100" y1="92" x2="94" y2="56" />
        <line x1="100" y1="92" x2="100" y2="72" />
        <line x1="100" y1="92" x2="101" y2="88" />
        <line x1="100" y1="92" x2="94" y2="102" />
        <line x1="100" y1="92" x2="78" y2="106" />
        <line x1="100" y1="92" x2="60" y2="96" />
        <line x1="100" y1="92" x2="54" y2="78" />
        <line x1="100" y1="92" x2="50" y2="56" />
        <line x1="100" y1="92" x2="56" y2="36" />
        <line x1="100" y1="92" x2="106" y2="26" />
        <line x1="100" y1="92" x2="120" y2="40" />
        <line x1="100" y1="92" x2="126" y2="60" />
        <line x1="100" y1="92" x2="123" y2="84" />
        <line x1="100" y1="92" x2="113" y2="98" />
        {/* Contorno */}
        <path
          d="M 68 22 L 84 38 L 94 56 L 100 72 L 101 88 L 94 102 L 78 106 L 60 96 L 54 78 L 50 56 L 56 36 L 68 22"
          strokeWidth="0.85"
          strokeOpacity="0.7"
        />
        <path
          d="M 68 22 L 106 26 L 120 40 L 126 60 L 123 84 L 113 98 L 94 102"
          strokeWidth="0.85"
          strokeOpacity="0.7"
        />
        {/* Tallo */}
        <path d="M 97 22 L 100 10 L 103 22" strokeWidth="1.2" strokeOpacity="0.75" />
        <path d="M 100 10 L 100 4" strokeWidth="1" strokeOpacity="0.75" />
      </g>
    </svg>
  );
}
