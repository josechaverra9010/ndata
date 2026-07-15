import { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import type { CSSProperties, MouseEventHandler } from "react";

interface StatsCardProps {
  title: string;
  value: string;
  change?: string;
  changeType?: "positive" | "negative" | "neutral";
  icon: LucideIcon;
  iconColor?: "primary" | "accent" | "info" | "warning";
  className?: string;
  style?: CSSProperties;
  onClick?: MouseEventHandler<HTMLDivElement>;
}

const iconColorClasses = {
  primary: "bg-primary/15 text-primary ring-primary/10",
  accent: "bg-accent/25 text-accent-foreground ring-accent/20",
  info: "bg-info/15 text-info ring-info/10",
  warning: "bg-warning/20 text-warning-foreground ring-warning/15",
};

const accentBars = {
  primary: "from-primary/80 to-primary/30",
  accent: "from-accent to-secondary",
  info: "from-info/80 to-info/30",
  warning: "from-warning to-secondary",
};

export function StatsCard({
  title,
  value,
  change,
  changeType = "neutral",
  icon: Icon,
  iconColor = "primary",
  className,
  style,
  onClick,
}: StatsCardProps) {
  return (
    <div
      style={style}
      role={onClick ? "button" : undefined}
      tabIndex={onClick ? 0 : undefined}
      onClick={onClick}
      onKeyDown={
        onClick
          ? (e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                onClick(e as any);
              }
            }
          : undefined
      }
      className={cn(
        "group relative overflow-hidden rounded-2xl border border-border/80 bg-card/90 p-5 shadow-card backdrop-blur-sm transition-all duration-300 hover:-translate-y-1 hover:shadow-card-hover animate-fade-in",
        onClick && "cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
        className
      )}
    >
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 bg-gradient-to-r opacity-90",
          accentBars[iconColor]
        )}
      />
      <div className="pointer-events-none absolute -right-6 -top-6 h-24 w-24 rounded-full bg-primary/[0.04] transition-transform duration-500 group-hover:scale-125" />

      <div className="relative flex items-start justify-between gap-3">
        <div className="space-y-2 min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            {title}
          </p>
          <p className="text-3xl font-bold tracking-tight text-foreground tabular-nums">
            {value}
          </p>
          {change && (
            <p
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                changeType === "positive" && "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300",
                changeType === "negative" && "bg-destructive/10 text-destructive",
                changeType === "neutral" && "bg-muted text-muted-foreground"
              )}
            >
              {changeType === "positive" && "↑ "}
              {changeType === "negative" && "↓ "}
              {change}
            </p>
          )}
        </div>
        <div
          className={cn(
            "flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl ring-1 transition-transform duration-300 group-hover:scale-110 group-hover:rotate-3",
            iconColorClasses[iconColor]
          )}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </div>
  );
}
