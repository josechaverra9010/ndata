import { Search, Plus, Command } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { UserDropdown } from "./UserDropdown";
import { useState } from "react";
import { MobileSidebar } from "@/components/MobileSidebar";
import { AdminSidebarContent } from "./AdminSidebarContent";
import { AdminQuickActions } from "./AdminQuickActions";
import { useNavigate } from "react-router-dom";

export function AdminHeader() {
  const [searchQuery, setSearchQuery] = useState("");
  const [quickOpen, setQuickOpen] = useState(false);
  const navigate = useNavigate();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/patients?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:px-6">
      <div className="flex items-center gap-3 min-w-0 flex-1">
        <MobileSidebar>
          <AdminSidebarContent />
        </MobileSidebar>
        <div className="relative hidden w-56 sm:block lg:w-80 xl:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Buscar pacientes…"
            className="pl-10 bg-muted/50 border-0 focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>

      <div className="flex items-center gap-1.5 lg:gap-3 shrink-0">
        <Button
          variant="outline"
          size="sm"
          className="hidden sm:inline-flex rounded-full gap-1.5 border-primary/20 bg-primary/5 text-primary hover:bg-primary/10"
          onClick={() => setQuickOpen(true)}
        >
          <Command className="h-3.5 w-3.5" />
          Acciones
          <kbd className="ml-1 hidden lg:inline-flex h-5 items-center rounded border bg-background px-1.5 font-mono text-[10px] text-muted-foreground">
            ⌘K
          </kbd>
        </Button>
        <Button
          size="sm"
          className="rounded-full gap-1.5 shadow-sm"
          onClick={() => setQuickOpen(true)}
        >
          <Plus className="h-4 w-4" />
          <span className="hidden xs:inline sm:inline">Rápido</span>
        </Button>
        <NotificationsDropdown />
        <UserDropdown />
      </div>

      <AdminQuickActions open={quickOpen} onOpenChange={setQuickOpen} />
    </header>
  );
}
