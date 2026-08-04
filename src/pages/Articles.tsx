import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useTheme } from "@/hooks/use-theme";
import {
  Moon,
  Sun,
  ArrowRight,
  BookOpen,
  Loader2,
  Search,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config/api";
import { formatInColombia } from "@/lib/timezone";

interface ArticleCard {
  id: number;
  slug?: string | null;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  image: string;
  date?: string | null;
  published_at?: string | null;
}

interface ArticleCategory {
  id: number;
  name: string;
  slug: string;
}

function articlePath(article: ArticleCard): string {
  if (article.slug) return `/article/${article.slug}`;
  return `/article/${article.id}`;
}

export default function Articles() {
  const { theme, setTheme } = useTheme();
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [apiCategories, setApiCategories] = useState<ArticleCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [category, setCategory] = useState("Todas");

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [articlesRes, catsRes] = await Promise.all([
          fetch(`${API_URL}/articles?limit=100`),
          fetch(`${API_URL}/articles/categories`),
        ]);
        if (!articlesRes.ok) throw new Error("Error cargando artículos");
        const data = await articlesRes.json();
        if (!cancelled) setArticles(Array.isArray(data) ? data : []);
        if (catsRes.ok) {
          const cats = await catsRes.json();
          if (!cancelled) setApiCategories(Array.isArray(cats) ? cats : []);
        }
      } catch (err) {
        console.error(err);
        if (!cancelled) setArticles([]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const categories = useMemo(() => {
    if (apiCategories.length) {
      return ["Todas", ...apiCategories.map((c) => c.name)];
    }
    const set = new Set(articles.map((a) => a.category).filter(Boolean));
    return ["Todas", ...Array.from(set).sort((a, b) => a.localeCompare(b, "es"))];
  }, [articles, apiCategories]);

  const filteredArticles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    return articles.filter((a) => {
      const matchesCategory = category === "Todas" || a.category === category;
      const matchesSearch =
        !q ||
        a.title.toLowerCase().includes(q) ||
        (a.excerpt || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.author || "").toLowerCase().includes(q);
      return matchesCategory && matchesSearch;
    });
  }, [articles, searchTerm, category]);

  const clearFilters = () => {
    setSearchTerm("");
    setCategory("Todas");
  };

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between gap-4">
              <div className="flex items-center gap-6">
                <Link to="/" className="flex items-center gap-2">
                  <img src="/logo.png" alt="NutriData" className="h-10 w-auto" />
                  <span className="text-xl font-bold text-foreground">NutriData</span>
                </Link>
                <div className="hidden sm:flex items-center gap-1 text-sm">
                  <Link
                    to="/"
                    className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    Inicio
                  </Link>
                  <Link
                    to="/articles"
                    className="px-3 py-2 rounded-lg font-medium text-primary bg-primary/10"
                  >
                    Artículos
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                  className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-accent transition-colors"
                  aria-label="Toggle theme"
                >
                  {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
                </button>
                <Link to="/auth">
                  <Button variant="default">Iniciar Sesión</Button>
                </Link>
              </div>
            </div>
          </div>
        </nav>

        <header className="relative overflow-hidden border-b border-border/60">
          <div className="absolute inset-0 bg-gradient-to-br from-primary/[0.08] via-background to-emerald-500/[0.06]" />
          <div className="container mx-auto px-4 py-12 lg:py-16 relative">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary mb-4">
                <BookOpen className="h-3.5 w-3.5" />
                Biblioteca pública
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-foreground">
                Artículos de nutrición
              </h1>
              <p className="mt-3 text-muted-foreground text-base md:text-lg max-w-2xl">
                Lee todos los artículos publicados por NutriData. Filtra por categoría o busca por
                tema.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                <Badge variant="secondary" className="rounded-full tabular-nums">
                  {articles.length} artículo{articles.length === 1 ? "" : "s"}
                </Badge>
                {category !== "Todas" && (
                  <Badge variant="outline" className="rounded-full">
                    {category}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </header>

        <main className="container mx-auto px-4 py-10 lg:py-12">
          <div className="rounded-2xl border border-border/70 bg-card/80 p-4 shadow-sm space-y-4 mb-8">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por título, resumen, categoría o autor…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10 h-11 rounded-full"
              />
              {searchTerm && (
                <button
                  type="button"
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  onClick={() => setSearchTerm("")}
                  aria-label="Limpiar búsqueda"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="flex flex-wrap gap-2">
              {categories.map((cat) => {
                const active = category === cat;
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={`rounded-full px-3 py-1.5 text-xs font-medium border transition-all ${
                      active
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-muted/40 text-muted-foreground border-border/70 hover:bg-muted hover:text-foreground"
                    }`}
                  >
                    {cat}
                  </button>
                );
              })}
            </div>

            <div className="flex items-center justify-between gap-2 pt-1 border-t border-border/50">
              <p className="text-xs text-muted-foreground">
                Mostrando{" "}
                <span className="font-semibold text-foreground tabular-nums">
                  {filteredArticles.length}
                </span>{" "}
                de{" "}
                <span className="font-semibold text-foreground tabular-nums">{articles.length}</span>
              </p>
              {(searchTerm || category !== "Todas") && (
                <Button variant="ghost" size="sm" className="h-8 rounded-full text-xs" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          </div>

          {loading ? (
            <div className="flex flex-col items-center justify-center py-24 gap-3 text-muted-foreground">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
              <p>Cargando artículos…</p>
            </div>
          ) : filteredArticles.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center">
              <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
              <h3 className="text-lg font-semibold text-foreground">
                {searchTerm || category !== "Todas"
                  ? "Sin resultados"
                  : "Aún no hay artículos publicados"}
              </h3>
              <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                {searchTerm || category !== "Todas"
                  ? "Prueba con otras palabras o cambia de categoría."
                  : "Cuando el equipo publique contenido, lo verás aquí."}
              </p>
              {(searchTerm || category !== "Todas") && (
                <Button className="mt-5 rounded-full" variant="outline" onClick={clearFilters}>
                  Limpiar filtros
                </Button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 lg:gap-8">
              {filteredArticles.map((article) => (
                <Link key={article.id} to={articlePath(article)}>
                  <Card className="group overflow-hidden border-border/60 hover:border-primary/25 transition-all hover:shadow-xl h-full cursor-pointer rounded-2xl">
                    <div className="aspect-video overflow-hidden relative">
                      <img
                        src={article.image}
                        alt={article.title}
                        className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent" />
                      <Badge className="absolute bottom-3 left-3 border-0 bg-background/90 text-foreground backdrop-blur-sm">
                        {article.category}
                      </Badge>
                    </div>
                    <CardHeader>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground mb-1">
                        <span>
                          {formatInColombia(article.published_at || article.date, {
                            day: "numeric",
                            month: "long",
                            year: "numeric",
                          })}
                        </span>
                        {article.author && (
                          <>
                            <span>·</span>
                            <span className="truncate">{article.author}</span>
                          </>
                        )}
                      </div>
                      <CardTitle className="group-hover:text-primary transition-colors text-lg leading-snug">
                        {article.title}
                      </CardTitle>
                      <CardDescription className="line-clamp-3">
                        {article.excerpt || "Lee el artículo completo"}
                      </CardDescription>
                    </CardHeader>
                    <CardFooter>
                      <Button
                        variant="ghost"
                        className="gap-2 px-0 hover:bg-transparent hover:text-primary"
                      >
                        Leer más <ArrowRight className="h-4 w-4" />
                      </Button>
                    </CardFooter>
                  </Card>
                </Link>
              ))}
            </div>
          )}
        </main>

        <footer className="border-t border-border py-10 bg-background mt-8">
          <div className="container mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-4">
            <Link to="/" className="flex items-center gap-2">
              <img src="/logo.png" alt="NutriData" className="h-8 w-auto" />
              <span className="font-semibold text-foreground">NutriData</span>
            </Link>
            <p className="text-sm text-muted-foreground">© 2026 NutriData</p>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
}
