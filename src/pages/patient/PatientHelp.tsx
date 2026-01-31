import { useState, useEffect } from "react";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Badge } from "@/components/ui/badge";
import { HelpCircle, Send, Search, MessageCircle, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

interface FAQ {
    id: number;
    category: string;
    question: string;
    answer: string;
    order: number;
}

interface Ticket {
    id: number;
    category: string;
    subject: string;
    message: string;
    status: string;
    priority: string;
    admin_response: string | null;
    created_at: string;
    updated_at: string;
    resolved_at: string | null;
}

const PatientHelp = () => {
    const { user } = useAuth();
    const { toast } = useToast();
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [searchQuery, setSearchQuery] = useState("");
    const [selectedCategory, setSelectedCategory] = useState<string>("all");
    const [loading, setLoading] = useState(true);

    // Form state
    const [formData, setFormData] = useState({
        category: "",
        subject: "",
        message: "",
        priority: "normal"
    });

    const categories = [
        { value: "nutrition", label: "Nutrición" },
        { value: "app_usage", label: "Uso de la App" },
        { value: "plans", label: "Planes" },
        { value: "general", label: "General" },
        { value: "technical", label: "Técnico" },
        { value: "billing", label: "Facturación" }
    ];

    useEffect(() => {
        fetchFAQs();
        fetchTickets();
    }, []);

    const fetchFAQs = async () => {
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/support/faqs`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });
            if (response.ok) {
                const data = await response.json();
                setFaqs(data);
            }
        } catch (error) {
            console.error("Error fetching FAQs:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchTickets = async () => {
        if (!user?.id) return;
        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/patient/${user.id}/support/tickets`, {
                headers: {
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                }
            });
            if (response.ok) {
                const data = await response.json();
                setTickets(data);
            }
        } catch (error) {
            console.error("Error fetching tickets:", error);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.category || !formData.subject || !formData.message) {
            toast({
                title: "Error",
                description: "Por favor completa todos los campos",
                variant: "destructive"
            });
            return;
        }

        try {
            const token = localStorage.getItem("userToken");
            const response = await fetch(`${API_URL}/support/ticket`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    patient_id: user?.id,
                    ...formData
                })
            });

            if (response.ok) {
                toast({
                    title: "Ticket creado",
                    description: "Tu solicitud ha sido enviada exitosamente"
                });
                setFormData({ category: "", subject: "", message: "", priority: "normal" });
                fetchTickets();
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo enviar el ticket",
                variant: "destructive"
            });
        }
    };

    const filteredFAQs = faqs.filter(faq => {
        const matchesSearch = faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
            faq.answer.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesCategory = selectedCategory === "all" || faq.category === selectedCategory;
        return matchesSearch && matchesCategory;
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case "resolved":
            case "closed":
                return <CheckCircle className="h-4 w-4 text-green-600" />;
            case "in_progress":
                return <Clock className="h-4 w-4 text-blue-600" />;
            default:
                return <AlertCircle className="h-4 w-4 text-amber-600" />;
        }
    };

    const getStatusBadge = (status: string) => {
        const variants: Record<string, string> = {
            open: "bg-amber-100 text-amber-800",
            in_progress: "bg-blue-100 text-blue-800",
            resolved: "bg-green-100 text-green-800",
            closed: "bg-gray-100 text-gray-800"
        };
        const labels: Record<string, string> = {
            open: "Abierto",
            in_progress: "En Progreso",
            resolved: "Resuelto",
            closed: "Cerrado"
        };
        return <Badge className={variants[status] || ""}>{labels[status] || status}</Badge>;
    };

    return (
        <PatientLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <HelpCircle className="h-7 w-7 text-primary" />
                        Ayuda y Soporte
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Encuentra respuestas a tus preguntas o contacta con tu nutricionista
                    </p>
                </div>

                {/* FAQs Section */}
                <Card>
                    <CardHeader>
                        <CardTitle>Preguntas Frecuentes</CardTitle>
                        <CardDescription>Encuentra respuestas rápidas a las preguntas más comunes</CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                        {/* Search and Filter */}
                        <div className="flex flex-col md:flex-row gap-3">
                            <div className="relative flex-1">
                                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                                <Input
                                    placeholder="Buscar en preguntas frecuentes..."
                                    value={searchQuery}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    className="pl-10"
                                />
                            </div>
                            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
                                <SelectTrigger className="w-full md:w-[200px]">
                                    <SelectValue placeholder="Categoría" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="all">Todas las categorías</SelectItem>
                                    {categories.map(cat => (
                                        <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {/* FAQ Accordion */}
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Cargando FAQs...</div>
                        ) : filteredFAQs.length > 0 ? (
                            <Accordion type="single" collapsible className="w-full">
                                {filteredFAQs.map((faq) => (
                                    <AccordionItem key={faq.id} value={`faq-${faq.id}`}>
                                        <AccordionTrigger className="text-left hover:no-underline">
                                            <span className="font-medium">{faq.question}</span>
                                        </AccordionTrigger>
                                        <AccordionContent>
                                            <p className="text-muted-foreground whitespace-pre-line">{faq.answer}</p>
                                        </AccordionContent>
                                    </AccordionItem>
                                ))}
                            </Accordion>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No se encontraron preguntas que coincidan con tu búsqueda
                            </div>
                        )}
                    </CardContent>
                </Card>

                {/* Contact Form */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <MessageCircle className="h-5 w-5 text-primary" />
                            Contactar Soporte
                        </CardTitle>
                        <CardDescription>¿No encontraste lo que buscabas? Envíanos un mensaje</CardDescription>
                    </CardHeader>
                    <CardContent>
                        <form onSubmit={handleSubmit} className="space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label htmlFor="category">Categoría *</Label>
                                    <Select value={formData.category} onValueChange={(value) => setFormData({ ...formData, category: value })}>
                                        <SelectTrigger id="category">
                                            <SelectValue placeholder="Selecciona una categoría" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {categories.map(cat => (
                                                <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                            ))}
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-2">
                                    <Label htmlFor="priority">Prioridad</Label>
                                    <Select value={formData.priority} onValueChange={(value) => setFormData({ ...formData, priority: value })}>
                                        <SelectTrigger id="priority">
                                            <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="low">Baja</SelectItem>
                                            <SelectItem value="normal">Normal</SelectItem>
                                            <SelectItem value="high">Alta</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="subject">Asunto *</Label>
                                <Input
                                    id="subject"
                                    placeholder="Describe brevemente tu consulta"
                                    value={formData.subject}
                                    onChange={(e) => setFormData({ ...formData, subject: e.target.value })}
                                />
                            </div>

                            <div className="space-y-2">
                                <Label htmlFor="message">Mensaje *</Label>
                                <Textarea
                                    id="message"
                                    placeholder="Describe tu consulta o problema en detalle..."
                                    rows={5}
                                    value={formData.message}
                                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                                />
                            </div>

                            <Button type="submit" className="w-full md:w-auto">
                                <Send className="h-4 w-4 mr-2" />
                                Enviar Ticket
                            </Button>
                        </form>
                    </CardContent>
                </Card>

                {/* Ticket History */}
                {tickets.length > 0 && (
                    <Card>
                        <CardHeader>
                            <CardTitle>Mis Tickets</CardTitle>
                            <CardDescription>Historial de tus solicitudes de soporte</CardDescription>
                        </CardHeader>
                        <CardContent>
                            <div className="space-y-3">
                                {tickets.map((ticket) => (
                                    <div key={ticket.id} className="border rounded-lg p-4 space-y-2">
                                        <div className="flex items-start justify-between">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1">
                                                    {getStatusIcon(ticket.status)}
                                                    <h4 className="font-semibold">{ticket.subject}</h4>
                                                </div>
                                                <p className="text-sm text-muted-foreground line-clamp-2">{ticket.message}</p>
                                            </div>
                                            <div className="ml-4">
                                                {getStatusBadge(ticket.status)}
                                            </div>
                                        </div>

                                        {ticket.admin_response && (
                                            <div className="mt-3 p-3 bg-muted rounded-md">
                                                <p className="text-sm font-medium mb-1">Respuesta del nutricionista:</p>
                                                <p className="text-sm text-muted-foreground">{ticket.admin_response}</p>
                                            </div>
                                        )}

                                        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2 border-t">
                                            <span>Categoría: {categories.find(c => c.value === ticket.category)?.label || ticket.category}</span>
                                            <span>•</span>
                                            <span>Creado: {new Date(ticket.created_at).toLocaleDateString()}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </PatientLayout>
    );
};

export default PatientHelp;
