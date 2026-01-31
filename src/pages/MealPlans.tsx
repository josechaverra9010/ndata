import { useState, useEffect } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Search, Plus, Filter, Users, Flame, Clock, Edit, Trash2, Calendar } from "lucide-react";
import { NewPlanWizard } from "@/components/admin/NewPlanWizard";
import { PlanDetailsDialog } from "@/components/admin/PlanDetailsDialog";
import { AssignPlanWithMenuDialog } from "@/components/admin/AssignPlanWithMenuDialog";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

interface MealPlan {
  id: number;
  name: string;
  description: string;
  calories: number;
  duration: string;
  category: string;
  color: string;
  protein_target?: number;
  carbs_target?: number;
  fat_target?: number;
  meals_per_day: number;
  patients: number;
  is_active: number;
  created_at?: string;
}

const categoryColors = {
  primary: "bg-primary/10 text-primary border-primary/20",
  accent: "bg-accent/10 text-accent border-accent/20",
  info: "bg-info/10 text-info border-info/20",
  success: "bg-success/10 text-success border-success/20",
  warning: "bg-warning/10 text-warning border-warning/20",
};

const MealPlans = () => {
  const { toast } = useToast();
  const [mealPlans, setMealPlans] = useState<MealPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [newPlanOpen, setNewPlanOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<MealPlan | null>(null);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [planToDelete, setPlanToDelete] = useState<MealPlan | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    fetchMealPlans();
  }, []);

  const fetchMealPlans = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/meal-plans`, {
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (response.ok) {
        const data = await response.json();
        setMealPlans(data);
      } else {
        toast({
          title: "Error",
          description: "No se pudieron cargar los planes nutricionales",
          variant: "destructive",
        });
      }
    } catch (error) {
      console.error("Error fetching meal plans:", error);
      toast({
        title: "Error de conexión",
        description: "No se pudo conectar con el servidor",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCreatePlan = async (newPlan: MealPlan) => {
    // El plan ya fue creado por el wizard, solo actualizamos la lista
    setMealPlans([...mealPlans, newPlan]);
    setNewPlanOpen(false);
    fetchMealPlans(); // Refrescar para obtener datos actualizados
  };

  const handleUpdatePlan = async (planId: number, planData: Omit<MealPlan, "id" | "patients" | "is_active" | "created_at">) => {
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/meal-plans/${planId}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        },
        body: JSON.stringify(planData),
      });

      if (response.ok) {
        const updatedPlan = await response.json();
        setMealPlans(mealPlans.map(p => p.id === planId ? updatedPlan : p));
        toast({ title: "¡Éxito!", description: "Plan actualizado correctamente" });
        setDetailsOpen(false);
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.detail || "No se pudo actualizar el plan", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error updating plan:", error);
      toast({ title: "Error", description: "Error al actualizar el plan", variant: "destructive" });
    }
  };

  const handleDeletePlan = async () => {
    if (!planToDelete) return;
    setIsDeleting(true);
    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/meal-plans/${planToDelete.id}`, {
        method: "DELETE",
        headers: {
          ...(token ? { "Authorization": `Bearer ${token}` } : {}),
        }
      });
      if (response.ok) {
        setMealPlans(mealPlans.filter(p => p.id !== planToDelete.id));
        toast({ title: "¡Éxito!", description: "Plan eliminado correctamente" });
        setDeleteDialogOpen(false);
        setPlanToDelete(null);
      } else {
        const error = await response.json();
        toast({ title: "Error", description: error.detail || "No se pudo eliminar el plan", variant: "destructive" });
      }
    } catch (error) {
      console.error("Error deleting plan:", error);
      toast({ title: "Error", description: "Error al eliminar el plan", variant: "destructive" });
    } finally {
      setIsDeleting(false);
    }
  };

  const confirmDelete = (plan: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    setPlanToDelete(plan);
    setDeleteDialogOpen(true);
  };

  const filteredPlans = mealPlans.filter(plan => {
    const matchesSearch = plan.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      plan.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = !categoryFilter || plan.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleViewDetails = (plan: MealPlan) => {
    setSelectedPlan(plan);
    setDetailsOpen(true);
  };

  const handleAssign = (plan: MealPlan, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedPlan(plan);
    setAssignOpen(true);
  };

  const categories = [...new Set(mealPlans.map(p => p.category))];

  if (loading) {
    return (
      <AdminLayout>
        <div className="flex items-center justify-center h-[calc(100vh-200px)]">
          <div className="text-center">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Cargando planes nutricionales...</p>
          </div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between animate-fade-in">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Planes Nutricionales</h1>
            <p className="text-muted-foreground">Crea y gestiona planes de alimentación personalizados</p>
          </div>
          <Button className="gradient-primary border-0" onClick={() => setNewPlanOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Crear Plan
          </Button>
        </div>

        <div className="flex items-center gap-4 animate-slide-up">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-10 bg-card border-border"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="h-4 w-4" />
                {categoryFilter || "Categoría"}
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent>
              <DropdownMenuItem onClick={() => setCategoryFilter(null)}>Todas</DropdownMenuItem>
              {categories.map(cat => (
                <DropdownMenuItem key={cat} onClick={() => setCategoryFilter(cat)}>{cat}</DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>

        <div className="grid gap-4 md:grid-cols-3 animate-slide-up" style={{ animationDelay: "50ms" }}>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-primary/10">
                <Calendar className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Total de Planes</p>
                <p className="text-2xl font-bold text-foreground">{mealPlans.length}</p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-accent/10">
                <Users className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Pacientes Asignados</p>
                <p className="text-2xl font-bold text-foreground">
                  {mealPlans.reduce((sum, plan) => sum + plan.patients, 0)}
                </p>
              </div>
            </div>
          </div>
          <div className="rounded-xl border border-border bg-card p-5">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-lg bg-success/10">
                <Flame className="h-5 w-5 text-success" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Categorías Activas</p>
                <p className="text-2xl font-bold text-foreground">{categories.length}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredPlans.map((plan, index) => (
            <div
              key={plan.id}
              className="group rounded-xl border border-border bg-card overflow-hidden shadow-card transition-all duration-300 hover:shadow-card-hover hover:-translate-y-1 animate-slide-up cursor-pointer"
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => handleViewDetails(plan)}
            >
              <div className={`h-1.5 ${plan.color === 'primary' ? 'gradient-primary' : plan.color === 'accent' ? 'gradient-accent' : `bg-${plan.color}`}`} />
              <div className="p-5">
                <div className="flex items-start justify-between mb-3">
                  <Badge variant="outline" className={categoryColors[plan.color as keyof typeof categoryColors]}>
                    {plan.category}
                  </Badge>
                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={(e) => { e.stopPropagation(); handleViewDetails(plan); }}>
                      <Edit className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="sm" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={(e) => confirmDelete(plan, e)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
                <h3 className="text-lg font-semibold text-foreground mb-2">{plan.name}</h3>
                <p className="text-sm text-muted-foreground mb-4 line-clamp-2">{plan.description}</p>
                <div className="grid grid-cols-3 gap-3 mb-4">
                  <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
                    <Flame className="h-4 w-4 text-accent mb-1" />
                    <span className="text-sm font-semibold text-foreground">{plan.calories}</span>
                    <span className="text-xs text-muted-foreground">kcal/día</span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
                    <Clock className="h-4 w-4 text-info mb-1" />
                    <span className="text-sm font-semibold text-foreground">{plan.duration.split(" ")[0]}</span>
                    <span className="text-xs text-muted-foreground">
                      {plan.duration.includes("semanas") ? "semanas" : plan.duration.includes("Continuo") ? "continuo" : ""}
                    </span>
                  </div>
                  <div className="flex flex-col items-center rounded-lg bg-muted/50 p-3">
                    <Users className="h-4 w-4 text-primary mb-1" />
                    <span className="text-sm font-semibold text-foreground">{plan.patients}</span>
                    <span className="text-xs text-muted-foreground">pacientes</span>
                  </div>
                </div>
                {(plan.protein_target || plan.carbs_target || plan.fat_target) && (
                  <div className="mb-4 p-3 rounded-lg bg-muted/30">
                    <p className="text-xs font-medium text-muted-foreground mb-2">Objetivos Macro</p>
                    <div className="flex gap-3 text-xs">
                      {plan.protein_target && <div><span className="font-semibold text-foreground">{plan.protein_target}g</span><span className="text-muted-foreground"> P</span></div>}
                      {plan.carbs_target && <div><span className="font-semibold text-foreground">{plan.carbs_target}g</span><span className="text-muted-foreground"> C</span></div>}
                      {plan.fat_target && <div><span className="font-semibold text-foreground">{plan.fat_target}g</span><span className="text-muted-foreground"> G</span></div>}
                    </div>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1 text-sm" onClick={(e) => { e.stopPropagation(); handleViewDetails(plan); }}>
                    Ver detalles
                  </Button>
                  <Button className="flex-1 text-sm gradient-primary border-0" onClick={(e) => handleAssign(plan, e)}>
                    Asignar
                  </Button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {filteredPlans.length === 0 && (
          <div className="text-center py-12 animate-fade-in">
            <div className="mx-auto w-24 h-24 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Calendar className="h-12 w-12 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground mb-2">No se encontraron planes</h3>
            <p className="text-muted-foreground mb-4">
              {searchQuery || categoryFilter ? "Intenta ajustar los filtros de búsqueda" : "Comienza creando tu primer plan nutricional"}
            </p>
            {!searchQuery && !categoryFilter && (
              <Button className="gradient-primary border-0" onClick={() => setNewPlanOpen(true)}>
                <Plus className="mr-2 h-4 w-4" />
                Crear Primer Plan
              </Button>
            )}
          </div>
        )}
      </div>

      <NewPlanWizard open={newPlanOpen} onOpenChange={setNewPlanOpen} onCreatePlan={handleCreatePlan} />
      <PlanDetailsDialog plan={selectedPlan} open={detailsOpen} onOpenChange={setDetailsOpen} onUpdatePlan={handleUpdatePlan} />
      <AssignPlanWithMenuDialog plan={selectedPlan} open={assignOpen} onOpenChange={setAssignOpen} onAssignSuccess={fetchMealPlans} />

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Estás seguro?</AlertDialogTitle>
            <AlertDialogDescription>
              Estás a punto de eliminar el plan "{planToDelete?.name}".
              {planToDelete && planToDelete.patients > 0 && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ Este plan tiene {planToDelete.patients} paciente(s) asignado(s). No se podrá eliminar hasta que remuevas las asignaciones.
                </span>
              )}
              {planToDelete && planToDelete.patients === 0 && <span className="block mt-2">Esta acción no se puede deshacer.</span>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>Cancelar</AlertDialogCancel>
            {planToDelete && planToDelete.patients === 0 && (
              <AlertDialogAction onClick={handleDeletePlan} disabled={isDeleting} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                {isDeleting ? "Eliminando..." : "Eliminar Plan"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default MealPlans;
