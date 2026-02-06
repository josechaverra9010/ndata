import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "@/config/api";
import { Lock, Eye, EyeOff, CheckCircle2, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

const RegisterNutritionist = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isValidating, setIsValidating] = useState(true);
  const [isSuccess, setIsSuccess] = useState(false);
  const [inviteInfo, setInviteInfo] = useState<{ email: string; name: string } | null>(null);
  const [formData, setFormData] = useState({ password: "", confirmPassword: "" });

  const rawToken = searchParams.get("token");
  const token = rawToken ? rawToken.trim() : null;

  useEffect(() => {
    if (!token) {
      toast.error("Enlace inválido o expirado");
      navigate("/auth", { replace: true });
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${API_URL}/auth/validate-invite?token=${encodeURIComponent(token)}`);
        const data = await res.json();
        if (cancelled) return;
        if (res.ok && data.valid) {
          setInviteInfo({ email: data.email, name: data.name });
        } else {
          toast.error(data.detail || "Enlace inválido o expirado");
          navigate("/auth", { replace: true });
        }
      } catch {
        if (!cancelled) {
          toast.error("Error al validar el enlace");
          navigate("/auth", { replace: true });
        }
      } finally {
        if (!cancelled) setIsValidating(false);
      }
    })();
    return () => { cancelled = true; };
  }, [token, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (formData.password !== formData.confirmPassword) {
      toast.error("Las contraseñas no coinciden");
      return;
    }
    if (formData.password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres");
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/complete-invite`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password: formData.password }),
      });
      const data = await res.json();
      if (res.ok) {
        setIsSuccess(true);
        toast.success("Cuenta activada. Ya puedes iniciar sesión.");
        setTimeout(() => navigate("/auth"), 3000);
      } else {
        toast.error(data.detail || "Error al completar el registro");
      }
    } catch {
      toast.error("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  if (!token || isValidating) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="text-center text-muted-foreground">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent mx-auto mb-4" />
          <p>Validando enlace...</p>
        </div>
      </div>
    );
  }

  if (isSuccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 text-center animate-fade-in">
          <div className="flex justify-center">
            <div className="flex h-20 w-20 items-center justify-center rounded-full bg-success/10">
              <CheckCircle2 className="h-10 w-10 text-success" />
            </div>
          </div>
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">¡Registro completado!</h2>
            <p className="text-muted-foreground">
              Tu cuenta de nutricionista está activa. Serás redirigido al inicio de sesión...
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-8 bg-background">
      <div className="w-full max-w-md space-y-8 animate-fade-in">
        <div className="flex flex-col items-center gap-4">
          <img src="/logo.png" alt="NutriData" className="h-24 w-auto" />
          <div className="text-center">
            <h1 className="text-2xl font-bold text-foreground">NutriData</h1>
            <p className="text-sm text-muted-foreground">Registro de nutricionista</p>
          </div>
        </div>

        <div className="space-y-2 text-center">
          <h2 className="text-3xl font-bold text-foreground">Completa tu registro</h2>
          {inviteInfo && (
            <p className="text-muted-foreground flex items-center justify-center gap-2 flex-wrap">
              <User className="h-4 w-4" />
              <span className="font-medium text-foreground">{inviteInfo.name}</span>
              <span>({inviteInfo.email})</span>
            </p>
          )}
          <p className="text-sm text-muted-foreground">Elige una contraseña para tu cuenta</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="space-y-2">
            <Label htmlFor="password" className="text-foreground">Contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="password"
                type={showPassword ? "text" : "password"}
                value={formData.password}
                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                className="pl-11 pr-11 h-12 bg-muted/50 border-border focus-visible:ring-primary/20"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword" className="text-foreground">Confirmar contraseña</Label>
            <div className="relative">
              <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="confirmPassword"
                type={showConfirmPassword ? "text" : "password"}
                value={formData.confirmPassword}
                onChange={(e) => setFormData({ ...formData, confirmPassword: e.target.value })}
                className="pl-11 pr-11 h-12 bg-muted/50 border-border focus-visible:ring-primary/20"
                required
                minLength={6}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </button>
            </div>
          </div>

          <Button
            type="submit"
            className="w-full h-12 text-base font-medium gradient-primary border-0 hover:opacity-90"
            disabled={isLoading}
          >
            {isLoading ? (
              <div className="flex items-center gap-2">
                <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                Activando cuenta...
              </div>
            ) : (
              "Activar cuenta e iniciar sesión"
            )}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate("/auth")}
              className="text-sm text-primary hover:text-primary/80"
            >
              Volver al inicio de sesión
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default RegisterNutritionist;
