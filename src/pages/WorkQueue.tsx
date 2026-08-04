import { useEffect, useState } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { WorkQueuePanel, type WorkQueueData } from "@/components/admin/WorkQueuePanel";
import { AtRiskPatientsWidget } from "@/components/admin/AtRiskPatientsWidget";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

export default function WorkQueuePage() {
  const { toast } = useToast();
  const [data, setData] = useState<WorkQueueData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("userToken");
    const headers = {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    };
    fetch(`${API_URL}/nutritionist/work-queue`, { headers })
      .then(async (res) => {
        if (!res.ok) throw new Error("No se pudo cargar la cola de trabajo");
        return res.json();
      })
      .then(setData)
      .catch((err) => {
        toast({
          title: "Error",
          description: err?.message || "Error al cargar la cola",
          variant: "destructive",
        });
      })
      .finally(() => setLoading(false));
  }, [toast]);

  return (
    <AdminLayout>
      <LoadingGate loading={loading} message="Cargando cola de trabajo">
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Cola de trabajo</h1>
          <p className="text-muted-foreground mt-1">
            Todas tus prioridades del día en un solo lugar
          </p>
        </div>
        <div className="grid gap-6 xl:grid-cols-3">
          <div className="xl:col-span-2">
            <WorkQueuePanel data={data} compact={false} />
          </div>
          <AtRiskPatientsWidget data={data} limit={10} />
        </div>
      </div>
      </LoadingGate>
    </AdminLayout>
  );
}
