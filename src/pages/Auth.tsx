import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { Mail, Lock, Eye, EyeOff, ArrowRight, Moon, Sun } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { useAuth } from "@/hooks/useAuth";
import { getRedirectPath } from "@/lib/auth";
import { useTheme } from "@/hooks/use-theme";
import { NutriDataParticles } from "@/components/NutriDataParticles";

const Auth = () => {
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
  const [requires2fa, setRequires2fa] = useState(false);
  const [tempToken, setTempToken] = useState("");
  const [totpCode, setTotpCode] = useState("");
  const [formData, setFormData] = useState({
    nombres: "",
    apellidos: "",
    email: "",
    password: "",
    telefono: "",
    fecha_nacimiento: "",
    genero: "",
    direccion: "",
  });
  const navigate = useNavigate();
  const { user, setUser, isLoading: authLoading } = useAuth();
  const { theme, setTheme } = useTheme();

  // Si ya está logeado, redirigir al dashboard según su rol
  useEffect(() => {
    if (authLoading) return;
    if (user?.role) {
      const path = getRedirectPath(user.role);
      navigate(path, { replace: true });
    }
  }, [user, authLoading, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const response = await fetch(`${API_URL}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(formData),
      });

      const data = await response.json();

      if (response.ok) {
        if (data.requires_2fa && data.temp_token) {
          setRequires2fa(true);
          setTempToken(data.temp_token);
          toast.info("Verificación 2FA", { description: "Ingresa el código de tu app autenticadora" });
          setIsLoading(false);
          return;
        }

        const userId = data.user.id;
        const userRole = data.user.role;

        console.log("User ID from token:", userId);
        console.log("User Role from token:", userRole);

        // Guardar el token
        localStorage.setItem("userToken", data.token);

        // Crear objeto de usuario con el ID correcto
        const userData = {
          id: userId,
          name: data.user.name,
          role: userRole,
          email: formData.email,
          profile_complete: data.profile_complete,
          altura: data.user.altura,
          peso_actual: data.user.peso_actual,
          avatar: data.user.avatar || "",
          createdAt: new Date().toISOString()
        };

        // Guardar datos completos del usuario
        localStorage.setItem("userData", JSON.stringify(userData));

        // Actualizar contexto global
        setUser(userData);

        toast.success("Bienvenido", {
          description: `Sesión iniciada como ${userData.name}`
        });

        // Redirección basada en el rol
        const path = getRedirectPath(userRole);
        console.log("Redirecting to:", path);
        navigate(path);
      } else {
        toast.error("Error", {
          description: data.detail || "Credenciales incorrectas"
        });
      }
    } catch (error) {
      console.error("Login error:", error);
      toast.error("Error de conexión", {
        description: "El servidor no responde"
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handle2faSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await fetch(`${API_URL}/auth/2fa/verify`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: totpCode, temp_token: tempToken }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.detail || "Código inválido");
      localStorage.setItem("userToken", data.token);
      const userData = {
        id: String(data.user.id),
        name: data.user.name,
        role: data.user.role,
        email: formData.email,
        avatar: data.user.avatar || "",
        createdAt: new Date().toISOString(),
      };
      localStorage.setItem("userData", JSON.stringify(userData));
      setUser(userData);
      toast.success("2FA verificado");
      navigate(getRedirectPath(data.user.role));
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Error 2FA");
    } finally {
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = resetEmail.trim().toLowerCase();
    if (!email) {
      toast.error("Ingresa tu correo electrónico");
      return;
    }
    setIsResetting(true);

    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });

      const data = await response.json().catch(() => ({}));

      if (response.ok) {
        toast.success("Enlace enviado", {
          description: data.message || "Si el correo está registrado, recibirás un enlace para restablecer tu contraseña. Revisa tu bandeja de entrada y spam."
        });
        setShowForgotPassword(false);
        setResetEmail("");
      } else {
        toast.error("Error", {
          description: (typeof data.detail === "string" ? data.detail : "No se pudo enviar el enlace. Inténtalo de nuevo.")
        });
      }
    } catch (error) {
      toast.error("Error de conexión", {
        description: "No se pudo conectar con el servidor. Revisa tu conexión e inténtalo de nuevo."
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Theme Toggle Button */}
      <button
        onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
        className="fixed top-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-background/80 backdrop-blur-sm hover:bg-accent transition-colors"
        aria-label="Toggle theme"
      >
        {theme === "dark" ? (
          <Sun className="h-5 w-5 text-foreground" />
        ) : (
          <Moon className="h-5 w-5 text-foreground" />
        )}
      </button>

      {/* Left side - Form + puntos verdes que forman "NutriData" y se distorsionan con el mouse */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background relative overflow-hidden">
        <NutriDataParticles className="opacity-90 max-lg:opacity-70" />
        <div className="w-full max-w-md space-y-8 animate-login-entrance relative z-10 pointer-events-auto">
          {/* Logo */}
          <div
            className="flex flex-col items-center gap-4 animate-login-stagger"
            style={{ animationDelay: "0.1s" }}
          >
            <img
              src="/logo.png"
              alt="NutriData"
              className="h-24 w-auto animate-float-subtle"
            />
            <div className="text-center">
              <h1 className="text-2xl font-bold text-foreground">NutriData</h1>
              <p className="text-sm text-muted-foreground">Panel de Control</p>
            </div>
          </div>

          {/* Header */}
          <div
            className="space-y-2 animate-login-stagger"
            style={{ animationDelay: "0.2s" }}
          >
            <h2 className="text-3xl font-bold text-foreground">
              Bienvenida de nuevo
            </h2>
            <p className="text-muted-foreground">
              Ingresa tus credenciales para acceder al panel
            </p>
          </div>

          {/* Form */}
          {requires2fa ? (
            <form onSubmit={handle2faSubmit} className="space-y-5 animate-login-stagger">
              <p className="text-sm text-muted-foreground">Código de autenticación (6 dígitos o backup)</p>
              <Input
                value={totpCode}
                onChange={(e) => setTotpCode(e.target.value.replace(/\s/g, ""))}
                placeholder="000000"
                className="h-12 text-center text-lg tracking-widest"
                maxLength={8}
                autoFocus
              />
              <Button type="submit" className="w-full h-12" disabled={isLoading}>
                {isLoading ? "Verificando..." : "Verificar 2FA"}
              </Button>
              <Button type="button" variant="ghost" className="w-full" onClick={() => { setRequires2fa(false); setTotpCode(""); }}>
                Volver al login
              </Button>
            </form>
          ) : (
          <form
            onSubmit={handleSubmit}
            className="space-y-5 animate-login-stagger"
            style={{ animationDelay: "0.3s" }}
          >


            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  className="pl-11 h-12 bg-muted/50 border-border focus-visible:ring-primary/20"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-foreground">Contraseña</Label>
                <Dialog open={showForgotPassword} onOpenChange={setShowForgotPassword}>
                  <DialogTrigger asChild>
                    <button
                      type="button"
                      className="text-sm text-primary hover:text-primary/80 transition-colors"
                    >
                      ¿Olvidaste tu contraseña?
                    </button>
                  </DialogTrigger>
                  <DialogContent>
                    <DialogHeader>
                      <DialogTitle>Recuperar contraseña</DialogTitle>
                      <DialogDescription>
                        Ingresa tu correo electrónico y te enviaremos un enlace para restablecer tu contraseña.
                      </DialogDescription>
                    </DialogHeader>
                    <form onSubmit={handleForgotPassword} className="space-y-4">
                      <div className="space-y-2">
                        <Label htmlFor="reset-email">Correo electrónico</Label>
                        <Input
                          id="reset-email"
                          type="email"
                          value={resetEmail}
                          onChange={(e) => setResetEmail(e.target.value)}
                          required
                        />
                      </div>
                      <DialogFooter>
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => setShowForgotPassword(false)}
                          disabled={isResetting}
                        >
                          Cancelar
                        </Button>
                        <Button type="submit" className="gradient-primary border-0" disabled={isResetting}>
                          {isResetting ? "Enviando..." : "Enviar enlace"}
                        </Button>
                      </DialogFooter>
                    </form>
                  </DialogContent>
                </Dialog>
              </div>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  value={formData.password}
                  onChange={handleInputChange}
                  className="pl-11 pr-11 h-12 bg-muted/50 border-border focus-visible:ring-primary/20"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                >
                  {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                </button>
              </div>
            </div>

            <Button
              type="submit"
              className="w-full h-12 text-base font-medium gradient-primary border-0 hover:opacity-90 transition-opacity"
              disabled={isLoading}
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                  Iniciando sesión...
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  Iniciar sesión
                  <ArrowRight className="h-5 w-5" />
                </div>
              )}
            </Button>
          </form>
          )}


        </div>
      </div>

      {/* Right side - Image */}
      <div className="hidden lg:flex flex-1 relative overflow-hidden">
        <img
          src="/uploads/nutri.jpg"
          alt="Nutrición Personalizada"
          className="w-full h-full object-cover"
        />
      </div>
    </div>
  );
};

export default Auth;