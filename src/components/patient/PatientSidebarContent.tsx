import { useEffect, useState } from "react";
import {
  LayoutDashboard,
  Apple,
  Calendar,
  MessageSquare,
  Settings,
  LogOut,
  TrendingUp,
  User,
  Utensils,
  ChefHat,
  HelpCircle,
  Target,
  Bell,
  BookOpen,
  ShoppingCart,
  FileText,
  Trophy,
  GraduationCap,
  Building2,
  HeartPulse,
  Camera,
  ArrowRightLeft,
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/use-theme";
import { fetchPatientFeatureFlags, isRouteEnabled, subscribeFeatureFlagRefresh } from "@/lib/featureFlags";

const menuItems = [
  { icon: LayoutDashboard, label: "Mi Dashboard", path: "/patient" },
  { icon: Utensils, label: "Mis Comidas", path: "/patient/meals" },
  { icon: Apple, label: "Mi Plan Nutricional", path: "/patient/my-plan" },
  { icon: Target, label: "Mi Adherencia", path: "/patient/adherence" },
  { icon: BookOpen, label: "Recomendaciones", path: "/patient/recommendations" },
  { icon: ShoppingCart, label: "Lista de Compras", path: "/patient/shopping-list" },
  { icon: FileText, label: "Mis Documentos", path: "/patient/documents" },
  { icon: Trophy, label: "Retos y Logros", path: "/patient/challenges" },
  { icon: GraduationCap, label: "Aprender", path: "/patient/learn" },
  { icon: HeartPulse, label: "Bienestar", path: "/patient/habits" },
  { icon: Camera, label: "Diario Fotográfico", path: "/patient/food-diary" },
  { icon: ArrowRightLeft, label: "Sustituciones", path: "/patient/substitutions" },
  { icon: Building2, label: "Mi Programa", path: "/patient/program" },
  { icon: ChefHat, label: "Recetas", path: "/patient/recipes" },
  { icon: TrendingUp, label: "Mi Progreso", path: "/patient/progress" },
  { icon: Calendar, label: "Mis Citas", path: "/patient/appointments" },
  { icon: Bell, label: "Notificaciones", path: "/patient/notifications" },
  { icon: MessageSquare, label: "Mensajes", path: "/patient/messages" },
  { icon: User, label: "Mi Perfil", path: "/patient/profile" },
  { icon: HelpCircle, label: "Ayuda", path: "/patient/help" },
];

const bottomMenuItems = [
  { icon: Settings, label: "Configuración", path: "/patient/settings" },
];

export function PatientSidebarContent() {
  const { logout } = useAuth();
  const { theme } = useTheme();
  const [flags, setFlags] = useState<Record<string, boolean> | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    fetchPatientFeatureFlags(token).then(setFlags);
    return subscribeFeatureFlagRefresh(fetchPatientFeatureFlags, setFlags);
  }, []);

  const visibleMenu = menuItems.filter((item) => {
    if (!flags) return true;
    return isRouteEnabled(item.path, flags);
  });

  return (
    <div className="flex h-full flex-col bg-sidebar">
      <div className="flex h-16 items-center gap-3 border-b border-sidebar-border px-6">
        <img
          src={theme === "dark" ? "/logo-dark.png" : "/logo-light.png"}
          alt="NutriData"
          className="h-10 w-auto"
        />
        <div>
          <h1 className="text-lg font-semibold text-foreground">NutriData</h1>
          <p className="text-xs text-muted-foreground">Panel del Paciente</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4 overflow-y-auto">
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
          onClick={() => logout()}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-destructive transition-all duration-200 hover:bg-destructive/10"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
