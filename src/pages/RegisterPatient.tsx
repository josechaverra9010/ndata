import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import {
  ArrowLeft,
  ArrowRight,
  Eye,
  EyeOff,
  Lock,
  Mail,
  Moon,
  Sun,
  User,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getRedirectPath } from "@/lib/auth";
import { useTheme } from "@/hooks/use-theme";

export default function RegisterPatient() {
  const navigate = useNavigate();
  const { setUser } = useAuth();
  const { theme, setTheme } = useTheme();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [acceptTerms, setAcceptTerms] = useState(false);
  const [form, setForm] = useState({
    nombres: "",
    apellidos: "",
    email: "",
    password: "",
    confirmPassword: "",
    telefono: "",
    fecha_nacimiento: "",
    genero: "",
    tipo_documento: "",
    numero_documento: "",
    altura: "",
    peso_actual: "",
    peso_objetivo: "",
    nivel_actividad: "",
    objetivos_salud: "",
    alimentos_disgusto: "",
  });

  const setField = (key: string, value: string) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password !== form.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (form.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    if (!acceptTerms) {
      toast.error("Debes aceptar los términos y la política de privacidad");
      return;
    }

    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nombres: form.nombres.trim(),
          apellidos: form.apellidos.trim(),
          email: form.email.trim().toLowerCase(),
          password: form.password,
          telefono: form.telefono.trim() || null,
          fecha_nacimiento: form.fecha_nacimiento || null,
          genero: form.genero || null,
          tipo_documento: form.tipo_documento || null,
          numero_documento: form.numero_documento.trim() || null,
          altura: form.altura ? parseFloat(form.altura) : null,
          peso_actual: form.peso_actual ? parseFloat(form.peso_actual) : null,
          peso_objetivo: form.peso_objetivo ? parseFloat(form.peso_objetivo) : null,
          nivel_actividad: form.nivel_actividad || null,
          objetivos_salud: form.objetivos_salud.trim() || null,
          alimentos_disgusto: form.alimentos_disgusto.trim() || null,
          accept_terms: true,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const detail = data.detail;
        throw new Error(
          typeof detail === "string"
            ? detail
            : Array.isArray(detail)
              ? detail.map((d: { msg?: string }) => d.msg).filter(Boolean).join(". ")
              : "No se pudo registrar"
        );
      }

      if (data.token && data.user) {
        localStorage.setItem("userToken", data.token);
        const userData = {
          id: data.user.id,
          name: data.user.name,
          role: data.user.role || "patient",
          email: data.user.email || form.email,
          profile_complete: data.profile_complete,
          altura: data.user.altura,
          peso_actual: data.user.peso_actual,
          avatar: data.user.avatar || "",
          createdAt: new Date().toISOString(),
        };
        localStorage.setItem("userData", JSON.stringify(userData));
        setUser(userData);
        toast.success("¡Cuenta creada!", {
          description: "Bienvenido a NutriData",
        });
        navigate(getRedirectPath(userData.role), { replace: true });
      } else {
        toast.success("Registro exitoso", {
          description: "Ya puedes iniciar sesión",
        });
        navigate("/auth", { replace: true });
      }
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Error al registrarse");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <button
        type="button"
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/80 backdrop-blur-sm hover:bg-accent transition-colors"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <Sun className="h-5 w-5" />
        ) : (
          <Moon className="h-5 w-5" />
        )}
      </button>

      <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <img src="/logo.png" alt="NutriData" className="h-20 w-auto" />
          <div>
            <h1 className="text-2xl font-bold text-foreground">Crear cuenta de paciente</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Regístrate para acceder a tu plan, comidas y progreso
            </p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="space-y-6 rounded-2xl border bg-card p-5 sm:p-8 shadow-sm"
        >
          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <User className="h-4 w-4 text-primary" />
              Datos personales
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="nombres">Nombres *</Label>
                <Input
                  id="nombres"
                  value={form.nombres}
                  onChange={(e) => setField("nombres", e.target.value)}
                  required
                  autoComplete="given-name"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="apellidos">Apellidos *</Label>
                <Input
                  id="apellidos"
                  value={form.apellidos}
                  onChange={(e) => setField("apellidos", e.target.value)}
                  required
                  autoComplete="family-name"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="email">Correo electrónico *</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    className="pl-10"
                    value={form.email}
                    onChange={(e) => setField("email", e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefono">Teléfono</Label>
                <Input
                  id="telefono"
                  value={form.telefono}
                  onChange={(e) => setField("telefono", e.target.value)}
                  autoComplete="tel"
                  placeholder="3001234567"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fecha_nacimiento">Fecha de nacimiento</Label>
                <Input
                  id="fecha_nacimiento"
                  type="date"
                  value={form.fecha_nacimiento}
                  onChange={(e) => setField("fecha_nacimiento", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Género</Label>
                <Select value={form.genero || undefined} onValueChange={(v) => setField("genero", v)}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="femenino">Femenino</SelectItem>
                    <SelectItem value="masculino">Masculino</SelectItem>
                    <SelectItem value="otro">Otro</SelectItem>
                    <SelectItem value="prefiero_no_decir">Prefiero no decir</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Tipo de documento</Label>
                <Select
                  value={form.tipo_documento || undefined}
                  onValueChange={(v) => setField("tipo_documento", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="CC">Cédula de ciudadanía</SelectItem>
                    <SelectItem value="CE">Cédula de extranjería</SelectItem>
                    <SelectItem value="TI">Tarjeta de identidad</SelectItem>
                    <SelectItem value="PAS">Pasaporte</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="numero_documento">Número de documento</Label>
                <Input
                  id="numero_documento"
                  value={form.numero_documento}
                  onChange={(e) => setField("numero_documento", e.target.value)}
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3">Datos de salud (opcional)</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div className="space-y-2">
                <Label htmlFor="altura">Altura (cm)</Label>
                <Input
                  id="altura"
                  type="number"
                  step="0.1"
                  min="50"
                  max="250"
                  value={form.altura}
                  onChange={(e) => setField("altura", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peso_actual">Peso actual (kg)</Label>
                <Input
                  id="peso_actual"
                  type="number"
                  step="0.1"
                  min="20"
                  max="400"
                  value={form.peso_actual}
                  onChange={(e) => setField("peso_actual", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="peso_objetivo">Peso objetivo (kg)</Label>
                <Input
                  id="peso_objetivo"
                  type="number"
                  step="0.1"
                  min="20"
                  max="400"
                  value={form.peso_objetivo}
                  onChange={(e) => setField("peso_objetivo", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label>Nivel de actividad</Label>
                <Select
                  value={form.nivel_actividad || undefined}
                  onValueChange={(v) => setField("nivel_actividad", v)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar" />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4}>
                    <SelectItem value="sedentario">Sedentario</SelectItem>
                    <SelectItem value="ligero">Ligero</SelectItem>
                    <SelectItem value="moderado">Moderado</SelectItem>
                    <SelectItem value="activo">Activo</SelectItem>
                    <SelectItem value="muy_activo">Muy activo</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="objetivos_salud">Objetivos de salud</Label>
                <Textarea
                  id="objetivos_salud"
                  rows={2}
                  value={form.objetivos_salud}
                  onChange={(e) => setField("objetivos_salud", e.target.value)}
                  placeholder="Ej: bajar de peso, mejorar energía…"
                />
              </div>
              <div className="space-y-2 sm:col-span-3">
                <Label htmlFor="alimentos_disgusto">Alimentos que no consumes / disgustos</Label>
                <Textarea
                  id="alimentos_disgusto"
                  rows={2}
                  value={form.alimentos_disgusto}
                  onChange={(e) => setField("alimentos_disgusto", e.target.value)}
                  placeholder="Ej: mariscos, brócoli, lácteos…"
                />
              </div>
            </div>
          </div>

          <div>
            <h2 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
              <Lock className="h-4 w-4 text-primary" />
              Contraseña
            </h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña *</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    className="pr-10"
                    value={form.password}
                    onChange={(e) => setField("password", e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowPassword((v) => !v)}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar contraseña *</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirm ? "text" : "password"}
                    className="pr-10"
                    value={form.confirmPassword}
                    onChange={(e) => setField("confirmPassword", e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                    onClick={() => setShowConfirm((v) => !v)}
                  >
                    {showConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl border p-3">
            <Checkbox
              id="terms"
              checked={acceptTerms}
              onCheckedChange={(v) => setAcceptTerms(v === true)}
            />
            <Label htmlFor="terms" className="text-sm font-normal leading-snug cursor-pointer">
              Acepto los{" "}
              <Link to="/terminos" className="text-primary underline-offset-2 hover:underline" target="_blank">
                términos de uso
              </Link>{" "}
              y la{" "}
              <Link to="/privacidad" className="text-primary underline-offset-2 hover:underline" target="_blank">
                política de privacidad
              </Link>
              .
            </Label>
          </div>

          <Button
            type="submit"
            className="w-full h-12 gradient-primary border-0"
            disabled={isLoading}
          >
            {isLoading ? (
              <span className="flex items-center gap-2">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Creando cuenta…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                Crear cuenta
                <ArrowRight className="h-5 w-5" />
              </span>
            )}
          </Button>

          <p className="text-center text-sm text-muted-foreground">
            ¿Ya tienes cuenta?{" "}
            <Link to="/auth" className="text-primary font-medium hover:underline">
              Iniciar sesión
            </Link>
          </p>

          <Button
            type="button"
            variant="ghost"
            className="w-full gap-2"
            onClick={() => navigate("/auth")}
          >
            <ArrowLeft className="h-4 w-4" />
            Volver al login
          </Button>
        </form>
      </div>
    </div>
  );
}
