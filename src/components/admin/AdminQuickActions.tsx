import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandShortcut,
} from "@/components/ui/command";
import {
  Calendar,
  CalendarDays,
  LayoutDashboard,
  MessageSquare,
  Plus,
  TrendingUp,
  UserPlus,
  Users,
  ChefHat,
  AlertCircle,
  ClipboardList,
  Stethoscope,
  BookOpen,
} from "lucide-react";

interface AdminQuickActionsProps {
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
}

export function AdminQuickActions({ open: controlledOpen, onOpenChange }: AdminQuickActionsProps) {
  const navigate = useNavigate();
  const [internalOpen, setInternalOpen] = useState(false);
  const open = controlledOpen ?? internalOpen;
  const setOpen = onOpenChange ?? setInternalOpen;

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen(true);
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [setOpen]);

  const go = (path: string) => {
    setOpen(false);
    navigate(path);
  };

  return (
    <CommandDialog open={open} onOpenChange={setOpen}>
      <CommandInput placeholder="Buscar acción rápida…" />
      <CommandList>
        <CommandEmpty>Sin resultados</CommandEmpty>
        <CommandGroup heading="Acciones rápidas">
          <CommandItem onSelect={() => go("/consultation")}>
            <Stethoscope className="mr-2 h-4 w-4" />
            Abrir consulta
          </CommandItem>
          <CommandItem onSelect={() => go("/patients?action=new")}>
            <UserPlus className="mr-2 h-4 w-4" />
            Nuevo paciente
            <CommandShortcut>N</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/appointments?action=new")}>
            <Plus className="mr-2 h-4 w-4" />
            Agendar cita
            <CommandShortcut>C</CommandShortcut>
          </CommandItem>
          <CommandItem onSelect={() => go("/weekly-menus")}>
            <CalendarDays className="mr-2 h-4 w-4" />
            Menú semanal
          </CommandItem>
          <CommandItem onSelect={() => go("/messages")}>
            <MessageSquare className="mr-2 h-4 w-4" />
            Mensajes
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Atención prioritaria">
          <CommandItem onSelect={() => go("/interventions")}>
            <BookOpen className="mr-2 h-4 w-4" />
            Biblioteca de intervenciones
          </CommandItem>
          <CommandItem onSelect={() => go("/work-queue")}>
            <ClipboardList className="mr-2 h-4 w-4 text-primary" />
            Cola de trabajo
          </CommandItem>
          <CommandItem onSelect={() => go("/patients?filter=sin_cita")}>
            <AlertCircle className="mr-2 h-4 w-4 text-amber-600" />
            Pacientes sin cita
          </CommandItem>
          <CommandItem onSelect={() => go("/patients?filter=sin_plan")}>
            <ClipboardList className="mr-2 h-4 w-4 text-rose-600" />
            Pacientes sin plan
          </CommandItem>
          <CommandItem onSelect={() => go("/appointments")}>
            <Calendar className="mr-2 h-4 w-4" />
            Ver calendario
          </CommandItem>
        </CommandGroup>
        <CommandGroup heading="Ir a">
          <CommandItem onSelect={() => go("/")}>
            <LayoutDashboard className="mr-2 h-4 w-4" />
            Dashboard
          </CommandItem>
          <CommandItem onSelect={() => go("/patients")}>
            <Users className="mr-2 h-4 w-4" />
            Pacientes
          </CommandItem>
          <CommandItem onSelect={() => go("/recipes")}>
            <ChefHat className="mr-2 h-4 w-4" />
            Recetas
          </CommandItem>
          <CommandItem onSelect={() => go("/progress")}>
            <TrendingUp className="mr-2 h-4 w-4" />
            Progreso
          </CommandItem>
        </CommandGroup>
      </CommandList>
    </CommandDialog>
  );
}
