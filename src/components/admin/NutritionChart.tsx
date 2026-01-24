// import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { useEffect, useState } from "react";
import { API_URL } from "@/config/api";

// Mock data fallback
const mockData = [
  { name: "Ene", consultas: 24, planes: 18 },
  { name: "Feb", consultas: 32, planes: 25 },
  { name: "Mar", consultas: 28, planes: 22 },
  { name: "Abr", consultas: 45, planes: 38 },
  { name: "May", consultas: 52, planes: 42 },
  { name: "Jun", consultas: 48, planes: 40 },
  { name: "Jul", consultas: 55, planes: 48 },
  { name: "Ago", consultas: 62, planes: 52 },
  { name: "Sep", consultas: 58, planes: 50 },
  { name: "Oct", consultas: 70, planes: 58 },
  { name: "Nov", consultas: 78, planes: 65 },
];

interface ChartData {
  name: string;
  consultas: number;
  planes: number;
}

export function NutritionChart() {
  const [data, setData] = useState<ChartData[]>(mockData);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchChartData = async () => {
      try {
        const response = await fetch(`${API_URL}/dashboard/chart-data`);
        if (response.ok) {
          const chartData = await response.json();
          // El endpoint devuelve un array con { key, month, consultas, planes }
          // Necesitamos mapearlo al formato esperado { name, consultas, planes }
          if (Array.isArray(chartData)) {
            const mappedData = chartData.map((item: any) => ({
              name: item.month || item.name || item.key,
              consultas: item.consultas || 0,
              planes: item.planes || 0
            }));
            setData(mappedData);
          } else {
            setData(mockData);
          }
        }
      } catch (error) {
        console.error("Error fetching chart data:", error);
        // Usar datos mock si falla
        setData(mockData);
      } finally {
        setLoading(false);
      }
    };

    fetchChartData();
  }, []);

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 shadow-card h-[400px] flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-6 shadow-card">
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-foreground">Resumen de Actividad</h3>
        <p className="text-sm text-muted-foreground">Consultas y planes creados este año</p>
      </div>
      <div className="flex items-center gap-6 mb-4">
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-primary" />
          <span className="text-sm text-muted-foreground">Consultas</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="h-3 w-3 rounded-full bg-accent" />
          <span className="text-sm text-muted-foreground">Planes Creados</span>
        </div>
      </div>
      <div className="h-[280px]">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="colorConsultas" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(145, 63%, 42%)" stopOpacity={0} />
              </linearGradient>
              <linearGradient id="colorPlanes" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0.3} />
                <stop offset="95%" stopColor="hsl(25, 95%, 53%)" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="hsl(145, 20%, 90%)" vertical={false} />
            <XAxis
              dataKey="name"
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(150, 10%, 45%)', fontSize: 12 }}
            />
            <YAxis
              axisLine={false}
              tickLine={false}
              tick={{ fill: 'hsl(150, 10%, 45%)', fontSize: 12 }}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'hsl(0, 0%, 100%)',
                border: '1px solid hsl(145, 20%, 90%)',
                borderRadius: '12px',
                boxShadow: '0 4px 6px -1px rgba(0,0,0,0.1)'
              }}
            />
            <Area
              type="monotone"
              dataKey="consultas"
              stroke="hsl(145, 63%, 42%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorConsultas)"
            />
            <Area
              type="monotone"
              dataKey="planes"
              stroke="hsl(25, 95%, 53%)"
              strokeWidth={2}
              fillOpacity={1}
              fill="url(#colorPlanes)"
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
