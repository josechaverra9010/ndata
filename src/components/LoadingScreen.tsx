import { cn } from "@/lib/utils";

interface LoadingScreenProps {
  message?: string;
  className?: string;
}

/**
 * Pantalla de carga con animación de persona trotando y texto "Cargando".
 */
export function LoadingScreen({ message = "Cargando", className }: LoadingScreenProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center min-h-[280px] py-12 px-4",
        className
      )}
    >
      {/* Corredor: figura simple con brazos y piernas animados */}
      <div className="relative mb-6">
        <svg
          viewBox="0 0 120 100"
          className="w-24 h-20 text-primary"
          aria-hidden
        >
          {/* Cabeza */}
          <circle
            cx="60"
            cy="18"
            r="10"
            fill="currentColor"
            className="opacity-90"
          />
          {/* Torso */}
          <line
            x1="60"
            y1="28"
            x2="60"
            y2="52"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className="opacity-90"
          />
          {/* Brazo trasero */}
          <line
            x1="60"
            y1="34"
            x2="42"
            y2="48"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            className="runner-arm-back"
            style={{ transformOrigin: "60px 34px" }}
          />
          {/* Brazo delantero */}
          <line
            x1="60"
            y1="34"
            x2="78"
            y2="44"
            stroke="currentColor"
            strokeWidth="5"
            strokeLinecap="round"
            className="runner-arm-front"
            style={{ transformOrigin: "60px 34px" }}
          />
          {/* Pierna trasera */}
          <line
            x1="60"
            y1="52"
            x2="44"
            y2="82"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className="runner-leg-back"
            style={{ transformOrigin: "60px 52px" }}
          />
          {/* Pierna delantera */}
          <line
            x1="60"
            y1="52"
            x2="76"
            y2="80"
            stroke="currentColor"
            strokeWidth="6"
            strokeLinecap="round"
            className="runner-leg-front"
            style={{ transformOrigin: "60px 52px" }}
          />
        </svg>
        {/* Suelo / movimiento */}
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-28 h-1 rounded-full bg-primary/20 overflow-hidden">
          <div className="h-full w-1/2 rounded-full bg-primary/40 runner-ground" />
        </div>
      </div>
      <p className="text-muted-foreground font-medium text-sm tracking-wide animate-pulse">
        {message}
      </p>
    </div>
  );
}
