import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Users,
  Calendar,
  MessageSquare,
  LifeBuoy,
  Settings,
  LogOut,
  ChefHat,
  TrendingUp,
  CalendarDays,
  Stethoscope,
  BarChart3,
  Building2,
  ClipboardList,
  BookOpen,
  Activity,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/use-theme";
import { fetchNutritionistFeatureFlags, isAdminRouteEnabled, subscribeFeatureFlagRefresh } from "@/lib/featureFlags";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/admin" },
  { icon: ClipboardList, label: "Cola de trabajo", path: "/work-queue" },
  { icon: Users, label: "Pacientes", path: "/patients" },
  { icon: Stethoscope, label: "Consulta", path: "/consultation" },
  { icon: BookOpen, label: "Intervenciones", path: "/interventions" },
  { icon: ChefHat, label: "Recetas", path: "/recipes" },
  { icon: CalendarDays, label: "Menú semanal", path: "/weekly-menus" },
  { icon: Calendar, label: "Citas", path: "/appointments" },
  { icon: TrendingUp, label: "Progreso", path: "/progress" },
  { icon: BarChart3, label: "Adherencia", path: "/analytics" },
  { icon: Activity, label: "Centro avanzado", path: "/clinical-hub" },
  { icon: Building2, label: "Clínica CO", path: "/clinical" },
  { icon: MessageSquare, label: "Mensajes", path: "/messages" },
  { icon: LifeBuoy, label: "Soporte", path: "/support" },
];

const bottomMenuItems = [
  { icon: Settings, label: "Configuración", path: "/settings" },
];

export function AdminSidebarContent() {
  const { logout } = useAuth();
  const { theme } = useTheme();
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    fetchNutritionistFeatureFlags(token).then(setFlags);
    return subscribeFeatureFlagRefresh(fetchNutritionistFeatureFlags, setFlags);
  }, []);

  const visibleMenu = menuItems.filter((item) => {
    if (!flags) return true;
    return isAdminRouteEnabled(item.path, flags);
  });

  const handleLogout = () => {
    logout();
  };

  return (
    <div className="flex h-full flex-col bg-sidebar">
      {/* Logo */}
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <img
          src={theme === 'dark' ? "/logo-dark.png" : "/logo-light.png"}
          alt="NutriData"
          className="h-10 w-auto"
        />
        <div>
          <h1 className="text-lg font-semibold text-foreground">NutriData</h1>
          <p className="text-xs text-muted-foreground">Panel de Nutricionista</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {visibleMenu.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            activeClassName="bg-primary/10 text-primary shadow-sm"
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-3">
        {bottomMenuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
            activeClassName="bg-primary/10 text-primary"
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-all duration-200 hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
