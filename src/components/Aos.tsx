import { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

type AosAnimation =
  | "fade-up"
  | "fade-down"
  | "fade-left"
  | "fade-right"
  | "fade"
  | "zoom-in"
  | "zoom-out"
  | "flip-up"
  | "flip-down"
  | "slide-up"
  | "slide-down";

interface AosProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  animation?: AosAnimation;
  delay?: number;
  duration?: number;
  offset?: number;
}

/**
 * Contenedor con animación AOS. Uso:
 * <Aos animation="fade-up" delay={100}>...</Aos>
 */
export function Aos({
  children,
  animation = "fade-up",
  delay,
  duration,
  offset,
  className,
  ...rest
}: AosProps) {
  return (
    <div
      data-aos={animation}
      data-aos-delay={delay != null ? String(delay) : undefined}
      data-aos-duration={duration != null ? String(duration) : undefined}
      data-aos-offset={offset != null ? String(offset) : undefined}
      className={cn(className)}
      {...rest}
    >
      {children}
    </div>
  );
}
