import { Bell, Shield, ChevronDown } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { MobileSidebar } from "@/components/MobileSidebar";
import { SuperadminSidebarContent } from "./SuperadminSidebarContent";

export function SuperadminHeader() {
  const { user, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:px-6">
      {/* Left side */}
      <div className="flex items-center gap-3">
        <MobileSidebar>
          <SuperadminSidebarContent />
        </MobileSidebar>
        <Badge variant="destructive" className="gap-1 text-xs lg:text-sm">
          <Shield className="h-3 w-3" />
          <span className="hidden sm:inline">Super Admin</span>
          <span className="sm:hidden">SA</span>
        </Badge>
        <span className="hidden text-sm text-muted-foreground md:block">Control total del sistema</span>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Notifications */}
        <button className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 transition-colors hover:bg-muted lg:h-10 lg:w-10">
          <Bell className="h-4 w-4 text-muted-foreground lg:h-5 lg:w-5" />
          <Badge className="absolute -right-1 -top-1 h-4 w-4 rounded-full p-0 text-[10px] bg-destructive border-0 flex items-center justify-center lg:h-5 lg:w-5 lg:text-xs">
            5
          </Badge>
        </button>

        {/* User profile */}
        <button 
          onClick={logout}
          className="flex items-center gap-2 rounded-full bg-muted/50 py-1 pl-1 pr-2 transition-colors hover:bg-muted lg:gap-3 lg:py-1.5 lg:pl-1.5 lg:pr-3"
        >
          <Avatar className="h-7 w-7 border-2 border-destructive/20 lg:h-8 lg:w-8">
            <AvatarImage src={user?.avatar || ""} />
            <AvatarFallback className="bg-destructive text-destructive-foreground text-xs lg:text-sm">
              {user?.name ? user.name.substring(0, 2).toUpperCase() : 'SA'}
            </AvatarFallback>
          </Avatar>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-medium text-foreground">{user?.name || 'Super Admin'}</p>
            <p className="text-xs text-muted-foreground">Cerrar sesión</p>
          </div>
          <ChevronDown className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>
    </header>
  );
}
