import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { ThemeProvider } from "@/components/ThemeProvider";
import { useTheme } from "@/hooks/use-theme";
import {
  Moon,
  Sun,
  ArrowRight,
  Newspaper,
  BookOpen,
  Users,
  Calendar,
  CheckCircle,
  TrendingUp,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { API_URL } from "@/config/api";
import { formatInColombia } from "@/lib/timezone";

const DEFAULT_HERO_IMAGE =
  "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=2000&q=80";

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

const features = [
  {
    icon: Users,
    title: "Nutricionistas Expertos",
    description: "Profesionales certificados listos para ayudarte",
  },
  {
    icon: CheckCircle,
    title: "Planes Personalizados",
    description: "Planes adaptados a tus necesidades y objetivos",
  },
  {
    icon: TrendingUp,
    title: "Seguimiento Continuo",
    description: "Monitorea tu progreso en tiempo real",
  },
  {
    icon: Calendar,
    title: "Citas Flexibles",
    description: "Agenda citas cuando mejor te convenga",
  },
];

const Home = () => {
  const { theme, setTheme } = useTheme();
  const [articles, setArticles] = useState<ArticleCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [heroImage, setHeroImage] = useState(DEFAULT_HERO_IMAGE);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        setLoading(true);
        const [articlesRes, heroRes] = await Promise.all([
          fetch(`${API_URL}/articles?limit=24`),
          fetch(`${API_URL}/home/hero`),
        ]);
        if (!articlesRes.ok) throw new Error("Error cargando artículos");
        const data = await articlesRes.json();
        if (!cancelled) setArticles(Array.isArray(data) ? data : []);

        if (heroRes.ok) {
          const heroData = await heroRes.json();
          if (!cancelled && heroData?.heroImage) setHeroImage(heroData.heroImage);
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

  const filteredArticles = useMemo(() => {
    const q = searchTerm.trim().toLowerCase();
    if (!q) return articles;
    return articles.filter(
      (a) =>
        a.title.toLowerCase().includes(q) ||
        (a.excerpt || "").toLowerCase().includes(q) ||
        (a.category || "").toLowerCase().includes(q) ||
        (a.author || "").toLowerCase().includes(q)
    );
  }, [articles, searchTerm]);

  return (
    <ThemeProvider attribute="class" defaultTheme="system" enableSystem disableTransitionOnChange>
      <div className="min-h-screen bg-background">
        <nav className="sticky top-0 z-50 w-full border-b border-border/50 bg-background/80 backdrop-blur-sm">
          <div className="container mx-auto px-4">
            <div className="flex h-16 items-center justify-between">
              <div className="flex items-center gap-2">
                <Link to="/" className="flex items-center gap-2">
                  <img src="/logo.png" alt="NutriData" className="h-10 w-auto" />
                  <span className="text-xl font-bold text-foreground">NutriData</span>
                </Link>
                <div className="hidden sm:flex items-center gap-1 text-sm ml-4">
                  <Link
                    to="/"
                    className="px-3 py-2 rounded-lg font-medium text-primary bg-primary/10"
                  >
                    Inicio
                  </Link>
                  <Link
                    to="/articles"
                    className="px-3 py-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors"
                  >
                    Artículos
                  </Link>
                </div>
              </div>
              <div className="flex items-center gap-4">
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

        {/* Hero with background image */}
        <section className="relative isolate overflow-hidden min-h-[70vh] lg:min-h-[78vh] flex items-center">
          <div className="absolute inset-0 -z-20">
            <img
              src={heroImage}
              alt="Alimentación saludable"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-black/70 via-black/55 to-background" />
          <div className="absolute inset-x-0 bottom-0 -z-10 h-40 bg-gradient-to-t from-background to-transparent" />

          <div className="container mx-auto px-4 relative z-10 py-20 lg:py-28">
            <div className="flex flex-col items-center text-center gap-8 max-w-4xl mx-auto">
              <div className="space-y-4">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/15 backdrop-blur-md border border-white/20 px-4 py-2 text-sm font-medium text-white">
                  <Newspaper className="h-4 w-4" />
                  <span>Contenido Nutricional Gratuito</span>
                </div>
                <h1 className="text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight text-white drop-shadow-sm">
                  Tu camino hacia una
                  <span className="bg-gradient-to-r from-emerald-300 to-lime-200 bg-clip-text text-transparent">
                    {" "}
                    vida más saludable
                  </span>
                </h1>
                <p className="text-lg md:text-xl text-white/85 max-w-2xl mx-auto">
                  Descubre artículos, noticias y consejos de nutrición creados por el equipo de
                  NutriData. Todo lo que necesitas para mejorar tu alimentación está aquí.
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-4">
                <Link to="/auth">
                  <Button size="lg" className="gap-2 shadow-lg">
                    Comienza Ahora <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
                <Link to="/articles">
                  <Button
                    size="lg"
                    variant="outline"
                    className="bg-white/10 border-white/30 text-white hover:bg-white/20 hover:text-white"
                  >
                    Explora Artículos
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        </section>

        <section className="py-16 bg-muted/30">
          <div className="container mx-auto px-4">
            <div className="text-center mb-12">
              <h2 className="text-3xl font-bold text-foreground mb-3">¿Por qué elegir NutriData?</h2>
              <p className="text-muted-foreground max-w-2xl mx-auto">
                Somos tu compañero ideal en el camino hacia una alimentación saludable
              </p>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {features.map((feature, index) => {
                const Icon = feature.icon;
                return (
                  <Card
                    key={index}
                    className="border-border/60 hover:border-primary/20 transition-all hover:shadow-lg"
                  >
                    <CardHeader>
                      <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center text-primary mb-3">
                        <Icon className="h-6 w-6" />
                      </div>
                      <CardTitle>{feature.title}</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <p className="text-muted-foreground">{feature.description}</p>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          </div>
        </section>

        <section id="articulos" className="py-20 scroll-mt-20">
          <div className="container mx-auto px-4">
            <div className="flex flex-col md:flex-row md:items-end md:justify-between mb-12 gap-4">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent mb-3">
                  <BookOpen className="h-3 w-3" />
                  <span>Artículos publicados</span>
                </div>
                <h2 className="text-3xl font-bold text-foreground">Noticias y Artículos</h2>
                <p className="text-muted-foreground mt-2">
                  Contenido publicado por el equipo de NutriData
                </p>
              </div>
              <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto md:items-center">
                <div className="w-full sm:w-72">
                  <Input
                    placeholder="Buscar artículos..."
                    className="h-10"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                  />
                </div>
                <Link to="/articles">
                  <Button variant="outline" className="w-full sm:w-auto gap-2">
                    Ver todos <ArrowRight className="h-4 w-4" />
                  </Button>
                </Link>
              </div>
            </div>

            {loading ? (
              <div className="flex flex-col items-center justify-center py-20 gap-3 text-muted-foreground">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                <p>Cargando artículos…</p>
              </div>
            ) : filteredArticles.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-border bg-muted/20 py-16 px-6 text-center">
                <BookOpen className="h-10 w-10 mx-auto mb-3 text-muted-foreground/60" />
                <h3 className="text-lg font-semibold text-foreground">
                  {searchTerm ? "Sin resultados" : "Aún no hay artículos publicados"}
                </h3>
                <p className="text-sm text-muted-foreground mt-2 max-w-md mx-auto">
                  {searchTerm
                    ? "Prueba con otras palabras clave."
                    : "Pronto verás aquí contenido nutricional de NutriData."}
                </p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                {filteredArticles.map((article) => (
                  <Link key={article.id} to={article.slug ? `/article/${article.slug}` : `/article/${article.id}`}>
                    <Card className="group overflow-hidden border-border/60 hover:border-primary/20 transition-all hover:shadow-xl h-full cursor-pointer">
                      <div className="aspect-video overflow-hidden">
                        <img
                          src={article.image}
                          alt={article.title}
                          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>
                      <CardHeader>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground mb-2">
                          <span className="px-2 py-1 rounded-full bg-primary/10 text-primary font-medium">
                            {article.category}
                          </span>
                          <span>
                            {formatInColombia(article.published_at || article.date, {
                              day: "numeric",
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        </div>
                        <CardTitle className="group-hover:text-primary transition-colors">
                          {article.title}
                        </CardTitle>
                        <CardDescription className="line-clamp-3">
                          {article.excerpt}
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
          </div>
        </section>

        <section className="py-20 bg-gradient-to-br from-primary/5 to-accent/10">
          <div className="container mx-auto px-4">
            <div className="max-w-3xl mx-auto text-center">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
                ¿Listo para transformar tu salud?
              </h2>
              <p className="text-lg text-muted-foreground mb-8">
                Crea una cuenta y comienza tu viaje hacia una vida más saludable con la ayuda de
                nuestros nutricionistas expertos.
              </p>
              <Link to="/auth">
                <Button size="lg" className="gap-2">
                  Iniciar Ahora <ArrowRight className="h-4 w-4" />
                </Button>
              </Link>
            </div>
          </div>
        </section>

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

export default Home;
