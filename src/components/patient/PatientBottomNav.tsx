import { Link, useLocation } from "react-router-dom";
import { Home, Utensils, Calendar, TrendingUp, User, ChefHat } from "lucide-react";
import { cn } from "@/lib/utils";

const navItems = [
  { to: "/patient", icon: Home, label: "Inicio" },
  { to: "/patient/recipes", icon: ChefHat, label: "Recetas" },
  { to: "/patient/appointments", icon: Calendar, label: "Citas" },
  { to: "/patient/progress", icon: TrendingUp, label: "Progreso" },
];

export function PatientBottomNav() {
  const location = useLocation();

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 border-t border-border bg-card/95 backdrop-blur-sm lg:hidden">
      <div className="flex items-center justify-around h-16 px-2">
        {navItems.map((item) => {
          const isActive = location.pathname === item.to;
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                "flex flex-col items-center justify-center gap-1 flex-1 h-full transition-colors",
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <item.icon className={cn("h-5 w-5", isActive && "text-primary")} />
              <span className="text-[10px] font-medium">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
