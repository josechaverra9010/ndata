import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { PatientLayout } from "@/layouts/PatientLayout";
import { LoadingGate } from "@/components/LoadingGate";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { API_URL } from "@/config/api";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/components/ui/use-toast";
import { BookOpen, Search, Sparkles } from "lucide-react";
import { formatInColombia } from "@/lib/timezone";

interface ArticleItem {
  id: number;
  title: string;
  excerpt: string;
  category: string;
  author: string;
  image?: string;
  published_at?: string;
  matched_tags?: string[];
  relevance_score?: number;
}

export default function PatientLearn() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [articles, setArticles] = useState<ArticleItem[]>([]);
  const [featured, setFeatured] = useState<ArticleItem[]>([]);
  const [tags, setTags] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("Todas");

  const patientId = user?.id;

  const load = useCallback(async () => {
    if (!patientId) return;
    setLoading(true);
    try {
      const token = localStorage.getItem("userToken");
      const params = new URLSearchParams();
      if (search.trim()) params.set("search", search.trim());
      const res = await fetch(`${API_URL}/patient/${patientId}/learn?${params}`, {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setArticles(Array.isArray(data.articles) ? data.articles : []);
      setFeatured(Array.isArray(data.featured) ? data.featured : []);
      setTags(Array.isArray(data.recommended_tags) ? data.recommended_tags : []);
    } catch {
      toast({ title: "Error", description: "No se pudo cargar el contenido", variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }, [patientId, search, toast]);

  useEffect(() => {
    const t = setTimeout(load, search ? 300 : 0);
    return () => clearTimeout(t);
  }, [load, search]);

  const categories = useMemo(() => {
    const set = new Set(articles.map((a) => a.category).filter(Boolean));
    return ["Todas", ...Array.from(set).sort()];
  }, [articles]);

  const filtered = useMemo(() => {
    return articles.filter((a) => category === "Todas" || a.category === category);
  }, [articles, category]);

  return (
    <PatientLayout>
      <LoadingGate loading={loading}>
        <div className="animate-fade-in space-y-6">
          <div>
            <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
              <BookOpen className="h-7 w-7 text-primary" />
              Educación Nutricional
            </h1>
            <p className="text-muted-foreground text-sm mt-1">
              Artículos recomendados según tu perfil y condiciones
            </p>
            {tags.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-3">
                {tags.map((t) => (
                  <Badge key={t} variant="secondary" className="text-[10px] capitalize">{t}</Badge>
                ))}
              </div>
            )}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar artículos..."
              className="pl-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {featured.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-semibold flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                Recomendados para ti
              </h2>
              <div className="grid gap-4 md:grid-cols-2">
                {featured.slice(0, 4).map((art) => (
                  <ArticleCard key={art.id} article={art} featured />
                ))}
              </div>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {categories.map((c) => (
              <Badge
                key={c}
                variant={category === c ? "default" : "outline"}
                className="cursor-pointer"
                onClick={() => setCategory(c)}
              >
                {c}
              </Badge>
            ))}
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {filtered.map((art) => (
              <ArticleCard key={art.id} article={art} />
            ))}
          </div>

          {filtered.length === 0 && !loading && (
            <Card className="border-dashed">
              <CardContent className="py-12 text-center text-muted-foreground">
                No hay artículos para mostrar.
              </CardContent>
            </Card>
          )}
        </div>
      </LoadingGate>
    </PatientLayout>
  );
}

function ArticleCard({ article, featured }: { article: ArticleItem; featured?: boolean }) {
  return (
    <Link to={`/article/${article.id}`}>
      <Card className={`h-full transition-all hover:border-primary/30 hover:shadow-md ${featured ? "border-primary/20" : ""}`}>
        {article.image && (
          <div className="h-36 overflow-hidden rounded-t-lg">
            <img src={article.image} alt="" className="h-full w-full object-cover" />
          </div>
        )}
        <CardHeader className="pb-2">
          <div className="flex items-center gap-2 mb-1">
            <Badge variant="outline" className="text-[10px]">{article.category}</Badge>
            {featured && article.relevance_score ? (
              <Badge className="text-[10px] bg-primary/10 text-primary border-0">Para ti</Badge>
            ) : null}
          </div>
          <CardTitle className="text-base line-clamp-2">{article.title}</CardTitle>
          <CardDescription className="line-clamp-2">{article.excerpt}</CardDescription>
        </CardHeader>
        <CardContent className="pt-0 text-[10px] text-muted-foreground">
          {article.published_at && formatInColombia(article.published_at, "dd MMM yyyy")}
        </CardContent>
      </Card>
    </Link>
  );
}
