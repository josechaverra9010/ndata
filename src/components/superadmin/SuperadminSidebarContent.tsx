import { useNavigate, useLocation } from "react-router-dom";
import { cn } from "@/lib/utils";
import { NavLink } from "@/components/NavLink";
import { useAuth } from "@/hooks/useAuth";
import { useTheme } from "@/hooks/use-theme";
import {
  LayoutDashboard,
  Users,
  UserCog,
  Building2,
  CreditCard,
  Settings,
  LogOut,
  ChefHat,
  Newspaper,
  Activity,
  Shield,
  Flag,
  Gauge,
  Scale,
  Plug,
  LifeBuoy,
  BarChart3,
  Stethoscope,
  ShieldCheck,
} from "lucide-react";

const menuItems = [
  { icon: LayoutDashboard, label: "Dashboard", path: "/superadmin" },
  { icon: Activity, label: "Salud tenant", path: "/superadmin/tenant-health" },
  { icon: Shield, label: "Auditoría", path: "/superadmin/audit" },
  { icon: Users, label: "Usuarios", path: "/superadmin/users" },
  { icon: UserCog, label: "Nutricionistas", path: "/superadmin/nutritionists" },
  { icon: ChefHat, label: "Biblioteca de Recetas", path: "/superadmin/recipes" },
  { icon: Newspaper, label: "Artículos Home", path: "/superadmin/articles" },
  { icon: Building2, label: "Organizaciones", path: "/superadmin/organizations" },
  { icon: CreditCard, label: "Facturación", path: "/superadmin/billing" },
  { icon: Flag, label: "Módulos / Flags", path: "/superadmin/features" },
  { icon: Gauge, label: "Ops / Monitoreo", path: "/superadmin/ops" },
  { icon: Scale, label: "Compliance CO", path: "/superadmin/compliance" },
  { icon: Plug, label: "Integraciones", path: "/superadmin/integrations" },
  { icon: LifeBuoy, label: "Soporte L2", path: "/superadmin/support" },
  { icon: BarChart3, label: "Analítica", path: "/superadmin/analytics" },
  { icon: Stethoscope, label: "Contenido clínico", path: "/superadmin/clinical-content" },
  { icon: ShieldCheck, label: "Plataforma", path: "/superadmin/platform" },
];

const bottomMenuItems = [
  { icon: Settings, label: "Configuración", path: "/superadmin/settings" },
];

export function SuperadminSidebarContent() {
  const navigate = useNavigate();
  const location = useLocation();
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
          <h1 className="text-lg font-bold text-foreground">SuperAdmin</h1>
          <p className="text-xs text-muted-foreground">Control Total</p>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 space-y-1 p-4">
        <p className="mb-3 px-3 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Gestión
        </p>
        {menuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname === item.path
                ? "bg-destructive/10 text-destructive"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
      </nav>

      {/* Bottom section */}
      <div className="border-t border-sidebar-border p-4">
        {bottomMenuItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            className={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-all duration-200",
              location.pathname === item.path
                ? "bg-destructive/10 text-destructive"
                : "text-sidebar-foreground hover:bg-sidebar-accent hover:text-sidebar-accent-foreground"
            )}
          >
            <item.icon className="h-5 w-5" />
            {item.label}
          </NavLink>
        ))}
        <button
          onClick={handleLogout}
          className="mt-2 flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-foreground transition-all duration-200 hover:bg-destructive/10 hover:text-destructive"
        >
          <LogOut className="h-5 w-5" />
          Cerrar Sesión
        </button>
      </div>
    </div>
  );
}
