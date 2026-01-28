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
  HelpCircle
} from "lucide-react";
import { NavLink } from "@/components/NavLink";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/use-theme";

const menuItems = [
  { icon: LayoutDashboard, label: "Mi Dashboard", path: "/patient" },
  { icon: Apple, label: "Mi Plan Nutricional", path: "/patient/my-plan" },
  { icon: ChefHat, label: "Recetas", path: "/patient/recipes" },
  { icon: TrendingUp, label: "Mi Progreso", path: "/patient/progress" },
  { icon: Calendar, label: "Mis Citas", path: "/patient/appointments" },
  { icon: MessageSquare, label: "Mensajes", path: "/patient/messages" },
  { icon: HelpCircle, label: "Ayuda", path: "/patient/help" },
];

const bottomMenuItems = [
  { icon: Settings, label: "Configuración", path: "/patient/settings" },
];

export function PatientSidebarContent() {
  const navigate = useNavigate();
  const { logout } = useAuth();
  const { theme } = useTheme();

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
          <p className="text-xs text-muted-foreground">Panel del Paciente</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 px-3 py-4">
        {menuItems.map((item) => (
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
