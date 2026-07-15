import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { API_URL } from "@/config/api";
import { BarChart3, Activity } from "lucide-react";

interface ChartData {
  name: string;
  consultas: number;
  planes: number;
}

export function NutritionChart() {
  const [data, setData] = useState<ChartData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const token = localStorage.getItem("userToken");
        const response = await fetch(`${API_URL}/dashboard/chart-data`, {
          headers: {
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (response.ok) {
          const chartData = await response.json();
          if (Array.isArray(chartData) && chartData.length > 0) {
            setData(
              chartData.map((item: any) => ({
                name: item.month || item.name || item.key,
                consultas: item.consultas || 0,
                planes: item.planes || 0,
              }))
            );
          } else {
            setData([]);
          }
        } else {
          setData([]);
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
        setData([]);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-card h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/80 bg-card/90 p-6 shadow-card backdrop-blur-sm h-full">
      <div className="mb-5 flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary ring-1 ring-primary/10">
            <Activity className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              Resumen de Actividad
            </h3>
            <p className="text-sm text-muted-foreground">
              Consultas y planes creados este año
            </p>
          </div>
        </div>
      </div>

      {data.length === 0 ? (
        <div className="h-[280px] flex flex-col items-center justify-center text-center text-muted-foreground rounded-xl border border-dashed border-border/70 bg-muted/20">
          <BarChart3 className="h-10 w-10 mb-3 opacity-40" />
          <p className="font-medium text-foreground">Sin datos aún</p>
          <p className="text-sm mt-1 max-w-xs">
            Cuando registres citas y planes, verás aquí el resumen de actividad.
          </p>
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-3 mb-4">
            <div className="flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
              <span className="h-2 w-2 rounded-full bg-primary" />
              Consultas
            </div>
            <div className="flex items-center gap-2 rounded-full bg-accent/20 px-3 py-1 text-xs font-medium text-accent-foreground">
              <span className="h-2 w-2 rounded-full bg-accent" />
              Planes creados
            </div>
          </div>
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorConsultas" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(102, 12%, 55%)" stopOpacity={0.35} />
                    <stop offset="95%" stopColor="hsl(102, 12%, 55%)" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="colorPlanes" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="hsl(37, 46%, 68%)" stopOpacity={0.4} />
                    <stop offset="95%" stopColor="hsl(37, 46%, 68%)" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(30, 20%, 88%)" vertical={false} />
                <XAxis
                  dataKey="name"
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(30, 15%, 45%)", fontSize: 12 }}
                />
                <YAxis
                  axisLine={false}
                  tickLine={false}
                  tick={{ fill: "hsl(30, 15%, 45%)", fontSize: 12 }}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(30, 62%, 98%)",
                    border: "1px solid hsl(30, 30%, 85%)",
                    borderRadius: "14px",
                    boxShadow: "0 8px 24px -8px rgba(0,0,0,0.12)",
                  }}
                />
                <Area
                  type="monotone"
                  dataKey="consultas"
                  stroke="hsl(102, 12%, 55%)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorConsultas)"
                />
                <Area
                  type="monotone"
                  dataKey="planes"
                  stroke="hsl(37, 46%, 58%)"
                  strokeWidth={2.5}
                  fillOpacity={1}
                  fill="url(#colorPlanes)"
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </>
      )}
    </div>
  );
}
