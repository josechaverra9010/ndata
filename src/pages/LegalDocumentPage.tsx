import { useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeft, FileText, Loader2 } from "lucide-react";
import { API_URL } from "@/config/api";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ThemeProvider } from "@/components/ThemeProvider";

type DocType = "privacy_policy" | "terms" | "cookies_policy";

const DOC_META: Record<DocType, { label: string; path: string }> = {
  privacy_policy: { label: "Política de privacidad", path: "/privacidad" },
  terms: { label: "Términos y condiciones", path: "/terminos" },
  cookies_policy: { label: "Política de cookies", path: "/cookies" },
};

function inlineMarkdown(text: string) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith("**") && part.endsWith("**")) {
      return (
        <strong key={i} className="font-semibold text-foreground">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
}

function renderMarkdown(md: string) {
  const lines = md.split("\n");
  const elements: JSX.Element[] = [];
  let listItems: string[] = [];
  let tableRows: string[][] = [];

  const flushList = (key: string) => {
    if (!listItems.length) return;
    elements.push(
      <ul key={key} className="list-disc pl-6 space-y-1 text-muted-foreground">
        {listItems.map((item, i) => (
          <li key={`${key}-${i}`}>{inlineMarkdown(item)}</li>
        ))}
      </ul>
    );
    listItems = [];
  };

  const flushTable = (key: string) => {
    if (tableRows.length < 2) {
      tableRows.forEach((row, i) => {
        elements.push(
          <p key={`${key}-fallback-${i}`} className="text-muted-foreground leading-relaxed">
            {row.join(" · ")}
          </p>
        );
      });
      tableRows = [];
      return;
    }
    const [header, ...body] = tableRows;
    elements.push(
      <div key={key} className="overflow-x-auto my-4">
        <table className="w-full text-sm border border-border rounded-lg overflow-hidden">
          <thead className="bg-muted/50">
            <tr>
              {header.map((cell, i) => (
                <th key={i} className="text-left px-3 py-2 font-semibold text-foreground border-b border-border">
                  {inlineMarkdown(cell.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {body.map((row, ri) => (
              <tr key={ri} className="border-b border-border last:border-0">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-muted-foreground align-top">
                    {inlineMarkdown(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
    tableRows = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList(`list-${idx}`);
      flushTable(`table-${idx}`);
      return;
    }
    if (trimmed === "---") {
      flushList(`list-${idx}`);
      flushTable(`table-${idx}`);
      elements.push(<hr key={`hr-${idx}`} className="my-6 border-border" />);
      return;
    }
    if (trimmed.startsWith("|") && trimmed.endsWith("|")) {
      flushList(`list-${idx}`);
      if (/^\|[\s\-:|]+\|$/.test(trimmed)) return;
      const cells = trimmed
        .slice(1, -1)
        .split("|")
        .map((c) => c.trim());
      tableRows.push(cells);
      return;
    }
    flushTable(`table-${idx}`);
    if (trimmed.startsWith("# ")) {
      flushList(`list-${idx}`);
      elements.push(
        <h1 key={`h1-${idx}`} className="text-3xl font-bold tracking-tight text-foreground mb-4">
          {inlineMarkdown(trimmed.slice(2))}
        </h1>
      );
      return;
    }
    if (trimmed.startsWith("## ")) {
      flushList(`list-${idx}`);
      elements.push(
        <h2 key={`h2-${idx}`} className="text-xl font-semibold text-foreground mt-8 mb-3">
          {inlineMarkdown(trimmed.slice(3))}
        </h2>
      );
      return;
    }
    if (trimmed.startsWith("### ")) {
      flushList(`list-${idx}`);
      elements.push(
        <h3 key={`h3-${idx}`} className="text-lg font-semibold text-foreground mt-6 mb-2">
          {inlineMarkdown(trimmed.slice(4))}
        </h3>
      );
      return;
    }
    if (trimmed.startsWith("- ")) {
      listItems.push(trimmed.slice(2));
      return;
    }
    flushList(`list-${idx}`);
    elements.push(
      <p key={`p-${idx}`} className="text-muted-foreground leading-relaxed">
        {inlineMarkdown(trimmed)}
      </p>
    );
  });

  flushList("list-final");
  flushTable("table-final");
  return elements;
}

export default function LegalDocumentPage({ docType }: { docType: DocType }) {
  const [searchParams] = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [doc, setDoc] = useState<{
    title: string;
    contentMd: string;
    version: string;
    effectiveAt?: string;
  } | null>(null);

  const meta = DOC_META[docType];

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${API_URL}/public/legal/${docType}`);
        if (!res.ok) {
          const errBody = await res.json().catch(() => ({}));
          const detail = typeof errBody.detail === "string"
            ? errBody.detail
            : Array.isArray(errBody.detail)
              ? errBody.detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(", ")
              : null;
          throw new Error(detail || `No se pudo cargar el documento (${res.status})`);
        }
        const data = await res.json();
        if (!cancelled) {
          setDoc({
            title: data.title,
            contentMd: data.contentMd,
            version: data.version,
            effectiveAt: data.effectiveAt,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Documento no disponible en este momento.");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [docType, searchParams.get("v")]);

  const content = useMemo(
    () => (doc?.contentMd ? renderMarkdown(doc.contentMd) : []),
    [doc?.contentMd]
  );

  return (
    <ThemeProvider>
      <div className="min-h-screen bg-background">
        <header className="border-b bg-card/80 backdrop-blur-sm sticky top-0 z-10">
          <div className="container mx-auto px-4 py-4 flex items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground">
              <ArrowLeft className="h-4 w-4" />
              Volver al inicio
            </Link>
            <div className="flex items-center gap-2">
              <img src="/logo.png" alt="NutriData" className="h-7 w-auto" />
              <span className="font-semibold hidden sm:inline">NutriData</span>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-10 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-2xl">
                <FileText className="h-6 w-6 text-primary" />
                {doc?.title || meta.label}
              </CardTitle>
              {doc?.version && (
                <p className="text-xs text-muted-foreground">
                  Versión {doc.version}
                  {doc.effectiveAt ? ` · Vigente desde ${doc.effectiveAt.slice(0, 10)}` : ""}
                </p>
              )}
            </CardHeader>
            <CardContent className="space-y-3 prose prose-neutral dark:prose-invert max-w-none">
              {loading ? (
                <div className="flex items-center gap-2 text-muted-foreground py-12 justify-center">
                  <Loader2 className="h-5 w-5 animate-spin" />
                  Cargando documento…
                </div>
              ) : error ? (
                <p className="text-destructive py-8 text-center">{error}</p>
              ) : (
                content
              )}
            </CardContent>
          </Card>

          <div className="mt-8 flex flex-wrap gap-3 justify-center text-sm">
            {Object.entries(DOC_META).map(([type, info]) => (
              <Link
                key={type}
                to={info.path}
                className={`underline-offset-4 hover:underline ${type === docType ? "text-primary font-semibold" : "text-muted-foreground"}`}
              >
                {info.label}
              </Link>
            ))}
          </div>

          <div className="mt-10 text-center">
            <Button asChild variant="outline">
              <Link to="/auth">Ir a iniciar sesión</Link>
            </Button>
          </div>
        </main>
      </div>
    </ThemeProvider>
  );
}
