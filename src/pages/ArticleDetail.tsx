import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useTheme } from "@/hooks/use-theme";
import { Moon, Sun, ArrowLeft, Calendar, User, ChevronRight, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { API_URL } from "@/config/api";
import { formatInColombia } from "@/lib/timezone";
import { ArticleContentView } from "@/components/articles/ArticleRichEditor";

interface Article {
  id: number;
  title: string;
  excerpt: string;
  content: string;
  category: string;
  author: string;
  image: string;
  date?: string | null;
  published_at?: string | null;
  related?: Article[];
}

const ArticleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { theme, setTheme } = useTheme();
  const [article, setArticle] = useState<Article | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      if (!id) {
        setNotFound(true);
        setLoading(false);
        return;
      }
      try {
        setLoading(true);
        setNotFound(false);
        const res = await fetch(`${API_URL}/articles/${id}`);
        if (res.status === 404) {
          if (!cancelled) setNotFound(true);
          return;
        }
        if (!res.ok) throw new Error("Error al cargar artículo");
        const data = await res.json();
        if (!cancelled) setArticle(data);
      } catch (err) {
        console.error(err);
        if (!cancelled) setNotFound(true);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    load();
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (loading) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
          <p className="text-sm text-muted-foreground">Cargando artículo…</p>
        </div>
      </ThemeProvider>
    );
  }

  if (notFound || !article) {
    return (
      <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
        <div className="min-h-screen bg-background flex items-center justify-center p-4">
          <Card className="max-w-md w-full">
            <CardHeader>
              <CardTitle>Artículo no encontrado</CardTitle>
              <CardDescription>
                El artículo que buscas no existe o aún no está publicado.
              </CardDescription>
            </CardHeader>
            <CardFooter>
              <Link to="/">
                <Button>Volver al inicio</Button>
              </Link>
            </CardFooter>
          </Card>
        </div>
      </ThemeProvider>
    );
  }

  const related = article.related || [];

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-4">
                <Link
                  to="/articles"
                  className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  <ArrowLeft className="h-4 w-4" />
                  <span>Artículos</span>
                </Link>
                <div className="flex items-center gap-2">
                  <img src="/logo.png" alt="NutriData" className="h-8 w-auto" />
                  <span className="text-lg font-semibold text-foreground hidden sm:block">
                    NutriData
                  </span>
                </div>
              </div>
              <button
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="flex h-9 w-9 items-center justify-center rounded-lg border border-border bg-background hover:bg-accent transition-colors"
                aria-label="Toggle theme"
              >
                {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>
            </div>
          </div>
        </nav>

        <header className="relative overflow-hidden">
          <div className="container mx-auto px-4 py-12">
            <div className="max-w-3xl mx-auto">
              <div className="flex items-center gap-3 mb-6 flex-wrap">
                <span className="px-3 py-1 rounded-full bg-primary/10 text-primary text-sm font-medium">
                  {article.category}
                </span>
                <span className="text-muted-foreground text-sm flex items-center gap-1">
                  <Calendar className="h-4 w-4" />
                  {formatInColombia(article.published_at || article.date, {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </span>
              </div>
              <h1 className="text-3xl md:text-4xl lg:text-5xl font-bold text-foreground mb-6">
                {article.title}
              </h1>
              <div className="flex items-center gap-3 text-muted-foreground">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  <span>{article.author}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="w-full max-w-5xl mx-auto px-4 mb-12">
            <div className="aspect-video rounded-2xl overflow-hidden shadow-lg">
              <img
                src={article.image}
                alt={article.title}
                className="w-full h-full object-cover"
              />
            </div>
          </div>
        </header>

        <article className="container mx-auto px-4 pb-20">
          <div className="max-w-3xl mx-auto">
            <ArticleContentView html={article.content} className="text-muted-foreground" />

            {related.length > 0 && (
              <div className="mt-16 pt-12 border-t border-border">
                <h2 className="text-2xl font-bold text-foreground mb-8">
                  También te puede interesar
                </h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {related.map((relatedArticle) => (
                    <Link key={relatedArticle.id} to={`/article/${relatedArticle.id}`}>
                      <Card className="hover:border-primary/20 transition-all hover:shadow-md cursor-pointer h-full">
                        <div className="aspect-video overflow-hidden rounded-t-xl">
                          <img
                            src={relatedArticle.image}
                            alt={relatedArticle.title}
                            className="w-full h-full object-cover transition-transform duration-500 hover:scale-105"
                          />
                        </div>
                        <CardHeader>
                          <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                            <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                              {relatedArticle.category}
                            </span>
                            <span>
                              {formatInColombia(
                                relatedArticle.published_at || relatedArticle.date,
                                {
                                  day: "numeric",
                                  month: "long",
                                  year: "numeric",
                                }
                              )}
                            </span>
                          </div>
                          <CardTitle className="text-lg">{relatedArticle.title}</CardTitle>
                          <CardDescription className="line-clamp-2">
                            {relatedArticle.excerpt}
                          </CardDescription>
                        </CardHeader>
                        <CardFooter className="pt-0 text-primary text-sm font-medium flex items-center gap-1">
                          Leer más <ChevronRight className="h-4 w-4" />
                        </CardFooter>
                      </Card>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </article>

        <footer className="border-t border-border py-12 bg-background">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row justify-between items-center gap-6">
              <div className="flex items-center gap-2">
                <img src="/logo.png" alt="NutriData" className="h-8 w-auto" />
                <span className="text-lg font-semibold text-foreground">NutriData</span>
              </div>
              <div className="flex gap-8 text-sm text-muted-foreground">
                <a href="#" className="hover:text-foreground transition-colors">
                  Términos de Servicio
                </a>
                <a href="#" className="hover:text-foreground transition-colors">
                  Política de Privacidad
                </a>
                <a href="#" className="hover:text-foreground transition-colors">
                  Contacto
                </a>
              </div>
            </div>
            <div className="mt-8 pt-8 border-t border-border text-center text-sm text-muted-foreground">
              © 2026 NutriData. Todos los derechos reservados.
            </div>
          </div>
        </footer>
      </div>
    </ThemeProvider>
  );
};

export default ArticleDetail;
