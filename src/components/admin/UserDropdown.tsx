import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ChevronDown, User, Settings, HelpCircle, LogOut } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";


import { useAuth } from "@/hooks/useAuth";
import { resolveMediaUrl } from "@/lib/media";



export function UserDropdown() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();



  const handleProfile = () => {
    toast.info("Abriendo perfil de usuario");
  };

  const handleSettings = () => {
    navigate("/settings");
  };

  const handleHelp = () => {
    toast.info("Abriendo centro de ayuda");
  };

  const handleLogout = () => {
    logout();
    toast.success("Sesión cerrada correctamente");
  };

  // Safe defaults if user is not loaded yet or null
  const userName = user?.name || "Usuario";
  // Assuming role map or just text
  const userRole = user?.role === 'superadmin' ? 'Super Administrador' : user?.role === 'admin' ? 'Nutricionista' : 'Paciente';

  // Obtener avatar del usuario (puede venir como avatar o foto_perfil)
  const userAvatar = user?.avatar || (user as any)?.foto_perfil || "";

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button className="flex items-center gap-3 rounded-full bg-muted/50 py-1.5 pl-1.5 pr-3 transition-colors hover:bg-muted">
          <Avatar className="h-8 w-8 border-2 border-primary/20">
            <AvatarImage src={resolveMediaUrl(userAvatar)} />
            <AvatarFallback className="bg-primary text-primary-foreground text-sm">
              {userName.substring(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="text-left">
            <p className="text-sm font-medium text-foreground">{userName}</p>
            <p className="text-xs text-muted-foreground">{userRole}</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {/*<DropdownMenuItem onClick={handleProfile} className="cursor-pointer">
          <User className="mr-2 h-4 w-4" />
          Mi Perfil
        </DropdownMenuItem>*/}
        <DropdownMenuItem onClick={handleSettings} className="cursor-pointer">
          <Settings className="mr-2 h-4 w-4" />
          Configuración
        </DropdownMenuItem>
        <DropdownMenuItem onClick={handleHelp} className="cursor-pointer">
          <HelpCircle className="mr-2 h-4 w-4" />
          Ayuda y Soporte
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={handleLogout} className="cursor-pointer text-destructive focus:text-destructive">
          <LogOut className="mr-2 h-4 w-4" />
          Cerrar Sesión
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
