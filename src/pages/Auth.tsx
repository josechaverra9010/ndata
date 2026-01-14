import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { API_URL } from "@/config/api";
import { Mail, Lock, Eye, EyeOff, ArrowRight } from "lucide-react";
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
import { Pear } from "../components/icons/Pear";

const Auth = () => {

  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [isResetting, setIsResetting] = useState(false);
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
  const { setUser } = useAuth();

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
        // El backend devuelve: { success, token, profile_complete, user: { name, role } }
        // Pero necesitamos el ID del usuario también

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
          profile_complete: data.profile_complete
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

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }));
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsResetting(true);

    try {
      const response = await fetch(`${API_URL}/forgot-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: resetEmail }),
      });

      const data = await response.json();

      if (response.ok) {
        toast.success("Enlace enviado", {
          description: data.message || "Si el correo existe, recibirás instrucciones para restablecer tu contraseña."
        });
        setShowForgotPassword(false);
        setResetEmail("");
      } else {
        toast.error("Error", {
          description: data.detail || "No se pudo realizar la solicitud."
        });
      }
    } catch (error) {
      toast.error("Error", {
        description: "No se pudo enviar el enlace. Inténtalo de nuevo."
      });
    } finally {
      setIsResetting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-background">
        <div className="w-full max-w-md space-y-8 animate-fade-in">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl gradient-primary shadow-glow">
              <Pear className="h-6 w-6 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-foreground">NutriData</h1>
              <p className="text-sm text-muted-foreground">Panel de Control</p>
            </div>
          </div>

          {/* Header */}
          <div className="space-y-2">
            <h2 className="text-3xl font-bold text-foreground">
              Bienvenida de nuevo
            </h2>
            <p className="text-muted-foreground">
              Ingresa tus credenciales para acceder al panel
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-5">


            <div className="space-y-2">
              <Label htmlFor="email" className="text-foreground">Correo electrónico</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="doctor@NutriData.com"
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
                          placeholder="doctor@nutridata.com"
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
                  placeholder="••••••••"
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