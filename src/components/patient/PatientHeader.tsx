import { useState, useEffect } from 'react';
import { Bell, ChevronDown, LogOut, User, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { MobileSidebar } from "@/components/MobileSidebar";
import { PatientSidebarContent } from "./PatientSidebarContent";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";

interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  date: string;
  priority: string;
  read: boolean;
}

interface PatientData {
  id: number;
  name: string;
  email: string;
  photo: string | null;
  phone: string | null;
}

export function PatientHeader() {
  const navigate = useNavigate();
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [loading, setLoading] = useState(true);

  const { user, logout } = useAuth();
  const patientId = user?.id;

  useEffect(() => {
    if (patientId) {
      fetchPatientData();
      fetchNotifications();
    }
  }, [patientId]);

  const fetchPatientData = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patient/${patientId}/dashboard`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      const data = await response.json();
      setPatientData(data.patient);
    } catch (error) {
      console.error('Error fetching patient data:', error);
    } finally {
      setLoading(false);
    }
  };

  const fetchNotifications = async () => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/patient/${patientId}/notifications`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      const data = await response.json();
      setNotifications(data.notifications || []);
      setUnreadCount(data.count || 0);
    } catch (error) {
      console.error('Error fetching notifications:', error);
    }
  };

  const handleLogout = () => {
    logout();
  };

  const handleNotificationClick = (notification: Notification) => {
    // Navegar según el tipo de notificación
    if (notification.type === 'appointment') {
      navigate('/paciente/citas');
    } else if (notification.type === 'reminder') {
      navigate('/paciente/progreso');
    }
  };

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return '¡Buenos días';
    if (hour < 18) return '¡Buenas tardes';
    return '¡Buenas noches';
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'high':
        return 'text-red-500';
      case 'medium':
        return 'text-yellow-500';
      default:
        return 'text-blue-500';
    }
  };

  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[1][0]}`.toUpperCase();
    }
    return name.substring(0, 2).toUpperCase();
  };

  if (loading) {
    return (
      <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:px-6">
        <div className="flex items-center gap-3">
          <div className="h-8 w-8 rounded-full bg-muted animate-pulse" />
          <div className="h-4 w-32 bg-muted rounded animate-pulse" />
        </div>
      </header>
    );
  }

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:px-6">
      {/* Left side - Mobile menu + Welcome */}
      <div className="flex items-center gap-3">
        <MobileSidebar>
          <PatientSidebarContent />
        </MobileSidebar>
        <div>
          <h2 className="text-base font-semibold text-foreground lg:text-lg">
            {getGreeting()}, {patientData?.name.split(' ')[0] || user?.nombres?.split(' ')[0] || user?.name?.split(' ')[0] || 'Paciente'}! 👋
          </h2>
          <p className="hidden text-sm text-muted-foreground sm:block">
            Sigue así, ¡vas muy bien con tu plan!
          </p>
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 lg:gap-4">
        {/* Notifications */}
        <Popover>
          <PopoverTrigger asChild>
            <button className="relative flex h-9 w-9 items-center justify-center rounded-full bg-muted/50 transition-colors hover:bg-muted lg:h-10 lg:w-10">
              <Bell className="h-4 w-4 text-muted-foreground lg:h-5 lg:w-5" />
              {unreadCount > 0 && (
                <Badge className="absolute -right-1 -top-1 h-5 w-5 rounded-full p-0 text-[10px] gradient-accent border-0 flex items-center justify-center lg:h-5 lg:w-5 lg:text-xs">
                  {unreadCount}
                </Badge>
              )}
            </button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <div className="flex items-center justify-between border-b border-border p-4">
              <h3 className="font-semibold text-foreground">Notificaciones</h3>
              {unreadCount > 0 && (
                <Badge variant="secondary" className="text-xs">
                  {unreadCount} nuevas
                </Badge>
              )}
            </div>
            <div className="max-h-[400px] overflow-y-auto">
              {notifications.length === 0 ? (
                <div className="p-8 text-center">
                  <Bell className="mx-auto h-12 w-12 text-muted-foreground/50 mb-2" />
                  <p className="text-sm text-muted-foreground">
                    No tienes notificaciones
                  </p>
                </div>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    onClick={() => handleNotificationClick(notification)}
                    className="w-full text-left p-4 border-b border-border hover:bg-muted/50 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <div className={`mt-1 h-2 w-2 rounded-full ${getPriorityColor(notification.priority)}`} />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {notification.title}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          {notification.message}
                        </p>
                        <p className="text-xs text-muted-foreground/70 mt-1">
                          {notification.date}
                        </p>
                      </div>
                    </div>
                  </button>
                ))
              )}
            </div>
            {notifications.length > 0 && (
              <div className="border-t border-border p-2">
                <button className="w-full text-center text-sm text-primary hover:text-primary/80 py-2">
                  Ver todas las notificaciones
                </button>
              </div>
            )}
          </PopoverContent>
        </Popover>

        {/* User profile dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex items-center gap-2 rounded-full bg-muted/50 py-1 pl-1 pr-2 transition-colors hover:bg-muted lg:gap-3 lg:py-1.5 lg:pl-1.5 lg:pr-3">
              <Avatar className="h-7 w-7 border-2 border-primary/20 lg:h-8 lg:w-8">
                {(patientData?.photo || user?.avatar || (user as any)?.foto_perfil) ? (
                  <AvatarImage
                    src={patientData?.photo || user?.avatar || (user as any)?.foto_perfil || ""}
                    alt={patientData?.name || user?.name || 'Paciente'}
                  />
                ) : (
                  <AvatarFallback className="bg-primary text-primary-foreground text-xs lg:text-sm">
                    {patientData ? getInitials(patientData.name) : (user?.name ? getInitials(user.name) : 'P')}
                  </AvatarFallback>
                )}
              </Avatar>
              <div className="hidden text-left sm:block">
                <p className="text-sm font-medium text-foreground">
                  {patientData?.name || 'Paciente'}
                </p>
                <p className="text-xs text-muted-foreground">Plan Premium</p>
              </div>
              <ChevronDown className="h-4 w-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-56">
            <DropdownMenuLabel>Mi Cuenta</DropdownMenuLabel>
            <DropdownMenuSeparator />
            {/*<DropdownMenuItem onClick={() => navigate('/paciente/perfil')}>
              <User className="mr-2 h-4 w-4" />
              <span>Mi Perfil</span>
            </DropdownMenuItem>*/}
            <DropdownMenuItem onClick={() => navigate('/paciente/configuracion')}>
              <Settings className="mr-2 h-4 w-4" />
              <span>Configuración</span>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleLogout}
              className="text-destructive focus:text-destructive"
            >
              <LogOut className="mr-2 h-4 w-4" />
              <span>Cerrar Sesión</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}