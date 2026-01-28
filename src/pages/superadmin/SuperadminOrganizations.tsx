import { useState } from "react";
import { SuperadminLayout } from "@/layouts/SuperadminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Search,
  Plus,
  MoreVertical,
  Building2,
  Users,
  UserCog,
  Trash2,
  Edit,
  Eye
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { toast } from "sonner";

interface Organization {
  id: string;
  name: string;
  email: string;
  plan: "free" | "basic" | "premium" | "enterprise";
  nutritionists: number;
  patients: number;
  status: "active" | "inactive" | "trial";
  createdAt: string;
}

const mockOrganizations: Organization[] = [
  { id: "1", name: "Clínica Salud Total", email: "admin@saludtotal.com", plan: "premium", nutritionists: 12, patients: 450, status: "active", createdAt: "2024-01-10" },
  { id: "2", name: "Centro Nutrición Plus", email: "contacto@nutricionplus.com", plan: "enterprise", nutritionists: 25, patients: 890, status: "active", createdAt: "2023-11-20" },
  { id: "3", name: "Consultorio Bienestar", email: "info@bienestar.com", plan: "basic", nutritionists: 3, patients: 85, status: "active", createdAt: "2024-03-15" },
  { id: "4", name: "NutriVida Integral", email: "hola@nutrivida.com", plan: "free", nutritionists: 1, patients: 15, status: "trial", createdAt: "2024-12-01" },
  { id: "5", name: "Clínica del Norte", email: "admin@clinicadelnorte.com", plan: "premium", nutritionists: 8, patients: 0, status: "inactive", createdAt: "2024-06-10" },
];

export default function SuperadminOrganizations() {
  const [organizations, setOrganizations] = useState<Organization[]>(mockOrganizations);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredOrganizations = organizations.filter(org =>
    org.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    org.email.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleDelete = (id: string) => {
    setOrganizations(organizations.filter(o => o.id !== id));
    toast.success("Organización eliminada");
  };

  const getPlanBadge = (plan: string) => {
    switch (plan) {
      case "enterprise":
        return <Badge className="bg-accent/10 text-accent border-0">Enterprise</Badge>;
      case "premium":
        return <Badge className="bg-primary/10 text-primary border-0">Premium</Badge>;
      case "basic":
        return <Badge className="bg-info/10 text-info border-0">Basic</Badge>;
      default:
        return <Badge variant="secondary">Free</Badge>;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "active":
        return <Badge className="bg-success/10 text-success border-0">Activo</Badge>;
      case "inactive":
        return <Badge className="bg-muted text-muted-foreground border-0">Inactivo</Badge>;
      case "trial":
        return <Badge className="bg-warning/10 text-warning border-0">Prueba</Badge>;
      default:
        return null;
    }
  };

  return (
    <SuperadminLayout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-foreground">Organizaciones</h1>
            <p className="text-muted-foreground">Gestiona las clínicas y centros registrados</p>
          </div>
          <Button className="gradient-primary border-0">
            <Plus className="h-4 w-4 mr-2" />
            Nueva Organización
          </Button>
        </div>

        {/* Stats */}
        <div className="grid gap-4 md:grid-cols-4">
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{organizations.length}</div>
              <p className="text-sm text-muted-foreground">Total organizaciones</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-success">{organizations.filter(o => o.status === "active").length}</div>
              <p className="text-sm text-muted-foreground">Activas</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{organizations.reduce((acc, o) => acc + o.nutritionists, 0)}</div>
              <p className="text-sm text-muted-foreground">Nutricionistas</p>
            </CardContent>
          </Card>
          <Card className="border-border bg-card">
            <CardContent className="pt-6">
              <div className="text-2xl font-bold text-foreground">{organizations.reduce((acc, o) => acc + o.patients, 0).toLocaleString()}</div>
              <p className="text-sm text-muted-foreground">Pacientes totales</p>
            </CardContent>
          </Card>
        </div>

        {/* Search */}
        <div className="relative max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Table */}
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-foreground">Lista de Organizaciones</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {filteredOrganizations.map((org) => (
                <div
                  key={org.id}
                  className="flex items-center gap-4 p-4 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
                >
                  <div className="h-12 w-12 rounded-lg bg-primary/10 flex items-center justify-center">
                    <Building2 className="h-6 w-6 text-primary" />
                  </div>
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium text-foreground">{org.name}</p>
                      {getPlanBadge(org.plan)}
                      {getStatusBadge(org.status)}
                    </div>
                    <p className="text-sm text-muted-foreground">{org.email}</p>
                  </div>
                  <div className="flex items-center gap-6 text-sm">
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <UserCog className="h-4 w-4" />
                        <span className="font-medium text-foreground">{org.nutritionists}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Nutris</p>
                    </div>
                    <div className="text-center">
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Users className="h-4 w-4" />
                        <span className="font-medium text-foreground">{org.patients}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">Pacientes</p>
                    </div>
                    <div className="text-muted-foreground">
                      <p className="text-xs">Creado</p>
                      <p className="text-sm text-foreground">{org.createdAt}</p>
                    </div>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem>
                        <Eye className="h-4 w-4 mr-2" />
                        Ver detalles
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="h-4 w-4 mr-2" />
                        Editar
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        onClick={() => handleDelete(org.id)}
                        className="text-destructive"
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        Eliminar
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </SuperadminLayout>
  );
}
