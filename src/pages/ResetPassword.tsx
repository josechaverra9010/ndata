import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { API_URL } from "@/config/api";
import { Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { useTheme } from "@/hooks/use-theme";

const ResetPassword = () => {
    const [searchParams] = useSearchParams();
    const navigate = useNavigate();
    const { theme } = useTheme();
    const [showPassword, setShowPassword] = useState(false);
    const [showConfirmPassword, setShowConfirmPassword] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [isSuccess, setIsSuccess] = useState(false);
    const [formData, setFormData] = useState({
        newPassword: "",
        confirmPassword: "",
    });

    const rawToken = searchParams.get("token");
    const token = rawToken ? rawToken.trim() : null;

    useEffect(() => {
        if (!token) {
            toast.error("Enlace inválido o expirado");
            navigate("/auth", { replace: true });
        }
    }, [token, navigate]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (formData.newPassword !== formData.confirmPassword) {
            toast.error("Las contraseñas no coinciden");
            return;
        }

        if (formData.newPassword.length < 6) {
            toast.error("La contraseña debe tener al menos 6 caracteres");
            return;
        }

        setIsLoading(true);

        try {
            const response = await fetch(`${API_URL}/reset-password`, {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    token,
                    new_password: formData.newPassword,
                }),
            });

            const data = await response.json();

            if (response.ok) {
                setIsSuccess(true);
                toast.success("Contraseña actualizada correctamente");
                setTimeout(() => {
                    navigate("/auth");
                }, 3000);
            } else {
                toast.error(data.detail || "Error al actualizar la contraseña");
            }
        } catch (error) {
            console.error("Reset password error:", error);
            toast.error("Error de conexión");
        } finally {
            setIsLoading(false);
        }
    };

    if (!token) {
        return (
            <div className="min-h-screen flex items-center justify-center p-8 bg-background">
                <div className="text-center text-muted-foreground">
                    <p>Redirigiendo al inicio de sesión...</p>
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
                        <h2 className="text-3xl font-bold text-foreground">
                            ¡Contraseña actualizada!
                        </h2>
                        <p className="text-muted-foreground">
                            Tu contraseña ha sido actualizada correctamente.
                            Serás redirigido al inicio de sesión...
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="min-h-screen flex items-center justify-center p-8 bg-background">
            <div className="w-full max-w-md space-y-8 animate-fade-in">
                {/* Logo */}
                <div className="flex flex-col items-center gap-4">
                    <img
                        src="/logo.png"
                        alt="NutriData"
                        className="h-24 w-auto"
                    />
                    <div className="text-center">
                        <h1 className="text-2xl font-bold text-foreground">NutriData</h1>
                        <p className="text-sm text-muted-foreground">Panel de Control</p>
                    </div>
                </div>

                {/* Header */}
                <div className="space-y-2 text-center">
                    <h2 className="text-3xl font-bold text-foreground">
                        Restablecer contraseña
                    </h2>
                    <p className="text-muted-foreground">
                        Ingresa tu nueva contraseña
                    </p>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="space-y-2">
                        <Label htmlFor="newPassword" className="text-foreground">
                            Nueva contraseña
                        </Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="newPassword"
                                type={showPassword ? "text" : "password"}
                                value={formData.newPassword}
                                onChange={(e) =>
                                    setFormData({ ...formData, newPassword: e.target.value })
                                }
                                className="pl-11 pr-11 h-12 bg-muted/50 border-border focus-visible:ring-primary/20"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                ) : (
                                    <Eye className="h-5 w-5" />
                                )}
                            </button>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="confirmPassword" className="text-foreground">
                            Confirmar contraseña
                        </Label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                            <Input
                                id="confirmPassword"
                                type={showConfirmPassword ? "text" : "password"}
                                value={formData.confirmPassword}
                                onChange={(e) =>
                                    setFormData({ ...formData, confirmPassword: e.target.value })
                                }
                                className="pl-11 pr-11 h-12 bg-muted/50 border-border focus-visible:ring-primary/20"
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                            >
                                {showConfirmPassword ? (
                                    <EyeOff className="h-5 w-5" />
                                ) : (
                                    <Eye className="h-5 w-5" />
                                )}
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
                                Actualizando...
                            </div>
                        ) : (
                            "Actualizar contraseña"
                        )}
                    </Button>

                    <div className="text-center">
                        <button
                            type="button"
                            onClick={() => navigate("/auth")}
                            className="text-sm text-primary hover:text-primary/80 transition-colors"
                        >
                            Volver al inicio de sesión
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
};

export default ResetPassword;
