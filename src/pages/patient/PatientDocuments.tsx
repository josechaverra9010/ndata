import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { Download, ExternalLink, FileText, Loader2 } from "lucide-react";

interface DocumentItem {
  id: string;
  title: string;
  description: string;
  available: boolean;
  download_path?: string | null;
  link_path?: string | null;
}

export default function PatientDocuments() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [documents, setDocuments] = useState<DocumentItem[]>([]);
  const [downloading, setDownloading] = useState<string | null>(null);

  const patientId = user?.id;

  const headers = () => {
    const token = localStorage.getItem("userToken");
    return token ? { Authorization: `Bearer ${token}` } : {};
  };

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const res = await fetch(`${API_URL}/patient/${patientId}/documents`, { headers: headers() });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setDocuments(Array.isArray(data.documents) ? data.documents : []);
    } catch {
      toast({ title: "Error", description: "No se pudieron cargar los documentos", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, toast]);

  useEffect(() => {
    load();
  }, [load]);

  const downloadPdf = async (doc: DocumentItem) => {
    if (!patientId || !doc.download_path) return;
    setDownloading(doc.id);
    try {
      const base = API_URL.replace(/\/api\/?$/, "");
      const path = doc.download_path.startsWith("/api/")
        ? doc.download_path
        : `/api${doc.download_path.startsWith("/") ? "" : "/"}${doc.download_path}`;
      const url = doc.id === "nutrition_report"
        ? `${API_URL}/patient/${patientId}/documents/nutrition-report`
        : `${base}${path}`;

      const res = await fetch(url, { headers: headers() });
      if (!res.ok) throw new Error();
      const blob = await res.blob();
      const objectUrl = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = objectUrl;
      a.download = doc.id === "nutrition_report" ? "informe-nutricional.pdf" : `${doc.id}.pdf`;
      a.click();
      URL.revokeObjectURL(objectUrl);
      toast({ title: "Descarga iniciada", description: doc.title });
    } catch {
      toast({ title: "Error", description: "No se pudo descargar el documento", variant: "destructive" });
    } finally {
      setDownloading(null);
    }
  };

  return (
    <PatientLayout>
      <LoadingGate loading={loading}>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <FileText className="h-7 w-7 text-primary" />
              Mis Documentos
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Informes y recursos disponibles para descargar
            </p>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {documents.map((doc) => (
              <Card key={doc.id} className={doc.available ? "" : "opacity-60"}>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <FileText className="h-5 w-5 text-primary/70" />
                    {doc.title}
                  </CardTitle>
                  <CardDescription>{doc.description}</CardDescription>
                </CardHeader>
                <CardContent>
                  {doc.download_path ? (
                    <Button
                      size="sm"
                      className="gap-2 rounded-full"
                      disabled={!doc.available || downloading === doc.id}
                      onClick={() => downloadPdf(doc)}
                    >
                      {downloading === doc.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Download className="h-4 w-4" />
                      )}
                      Descargar PDF
                    </Button>
                  ) : doc.link_path ? (
                    <Button
                      size="sm"
                      variant="outline"
                      className="gap-2 rounded-full"
                      onClick={() => navigate(doc.link_path!)}
                    >
                      <ExternalLink className="h-4 w-4" />
                      Ver en la app
                    </Button>
                  ) : null}
                </CardContent>
              </Card>
            ))}
          </div>

          {documents.length === 0 && !loading && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay documentos disponibles por ahora.
              </CardContent>
            </Card>
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}
