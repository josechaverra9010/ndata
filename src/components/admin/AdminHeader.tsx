import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { NotificationsDropdown } from "./NotificationsDropdown";
import { UserDropdown } from "./UserDropdown";
import { useState } from "react";
import { toast } from "sonner";
import { MobileSidebar } from "@/components/MobileSidebar";
import { AdminSidebarContent } from "./AdminSidebarContent";

import { useNavigate } from "react-router-dom";

export function AdminHeader() {
  const [searchQuery, setSearchQuery] = useState("");
  const navigate = useNavigate();

  const handleSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter" && searchQuery.trim()) {
      navigate(`/patients?search=${encodeURIComponent(searchQuery.trim())}`);
    }
  };

  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between border-b border-border bg-card/80 px-4 backdrop-blur-sm lg:px-6">
      {/* Left side - Mobile menu + Search */}
      <div className="flex items-center gap-3">
        <MobileSidebar>
          <AdminSidebarContent />
        </MobileSidebar>
        <div className="relative hidden w-64 sm:block lg:w-96">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            className="pl-10 bg-muted/50 border-0 focus-visible:ring-primary/20"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={handleSearch}
          />
        </div>
      </div>

      {/* Right side */}
      <div className="flex items-center gap-2 lg:gap-4">
        <NotificationsDropdown />
        <UserDropdown />
      </div>
    </header>
  );
}
