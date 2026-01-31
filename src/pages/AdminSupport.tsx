import { useState, useEffect } from "react";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { MessageSquare, Filter, Send, CheckCircle, Clock, AlertCircle, Plus } from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

interface Ticket {
    id: number;
    patient_id: number;
    patient_name: string;
    patient_email: string;
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

const AdminSupport = () => {
    const { toast } = useToast();
    const [tickets, setTickets] = useState<Ticket[]>([]);
    const [selectedTicket, setSelectedTicket] = useState<Ticket | null>(null);
    const [response, setResponse] = useState("");
    const [filterStatus, setFilterStatus] = useState<string>("all");
    const [filterCategory, setFilterCategory] = useState<string>("all");
    const [loading, setLoading] = useState(true);

    const categories = [
        { value: "nutrition", label: "Nutrición" },
        { value: "app_usage", label: "Uso de la App" },
        { value: "plans", label: "Planes" },
        { value: "general", label: "General" },
        { value: "technical", label: "Técnico" },
        { value: "billing", label: "Facturación" }
    ];

    useEffect(() => {
        fetchTickets();
    }, [filterStatus, filterCategory]);

    const fetchTickets = async () => {
        try {
            let url = `${API_URL}/support/tickets?`;
            if (filterStatus !== "all") url += `status=${filterStatus}&`;
            if (filterCategory !== "all") url += `category=${filterCategory}`;

            const token = localStorage.getItem("userToken");
            const response = await fetch(url, {
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
        } finally {
            setLoading(false);
        }
    };

    const handleRespond = async (ticketId: number) => {
        if (!response.trim()) {
            toast({
                title: "Error",
                description: "Por favor escribe una respuesta",
                variant: "destructive"
            });
            return;
        }

        try {
            const token = localStorage.getItem("userToken");
            const res = await fetch(`${API_URL}/support/ticket/${ticketId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({
                    admin_response: response,
                    status: "in_progress"
                })
            });

            if (res.ok) {
                toast({
                    title: "Respuesta enviada",
                    description: "El paciente ha sido notificado"
                });
                setResponse("");
                setSelectedTicket(null);
                fetchTickets();
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo enviar la respuesta",
                variant: "destructive"
            });
        }
    };

    const handleStatusChange = async (ticketId: number, newStatus: string) => {
        try {
            const token = localStorage.getItem("userToken");
            const res = await fetch(`${API_URL}/support/ticket/${ticketId}`, {
                method: "PUT",
                headers: {
                    "Content-Type": "application/json",
                    ...(token ? { "Authorization": `Bearer ${token}` } : {}),
                },
                body: JSON.stringify({ status: newStatus })
            });

            if (res.ok) {
                toast({
                    title: "Estado actualizado",
                    description: `Ticket marcado como ${newStatus}`
                });
                fetchTickets();
            }
        } catch (error) {
            toast({
                title: "Error",
                description: "No se pudo actualizar el estado",
                variant: "destructive"
            });
        }
    };

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

    const getPriorityBadge = (priority: string) => {
        const variants: Record<string, string> = {
            low: "bg-gray-100 text-gray-800",
            normal: "bg-blue-100 text-blue-800",
            high: "bg-red-100 text-red-800"
        };
        const labels: Record<string, string> = {
            low: "Baja",
            normal: "Normal",
            high: "Alta"
        };
        return <Badge variant="outline" className={variants[priority] || ""}>{labels[priority] || priority}</Badge>;
    };

    const filteredTickets = tickets;

    return (
        <AdminLayout>
            <div className="space-y-6">
                {/* Header */}
                <div>
                    <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
                        <MessageSquare className="h-7 w-7 text-primary" />
                        Soporte
                    </h1>
                    <p className="text-muted-foreground mt-1">
                        Gestiona los tickets de soporte de tus pacientes
                    </p>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{tickets.filter(t => t.status === "open").length}</div>
                            <p className="text-xs text-muted-foreground">Tickets Abiertos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{tickets.filter(t => t.status === "in_progress").length}</div>
                            <p className="text-xs text-muted-foreground">En Progreso</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{tickets.filter(t => t.status === "resolved").length}</div>
                            <p className="text-xs text-muted-foreground">Resueltos</p>
                        </CardContent>
                    </Card>
                    <Card>
                        <CardContent className="pt-6">
                            <div className="text-2xl font-bold">{tickets.filter(t => t.priority === "high").length}</div>
                            <p className="text-xs text-muted-foreground">Alta Prioridad</p>
                        </CardContent>
                    </Card>
                </div>

                {/* Filters */}
                <Card>
                    <CardHeader>
                        <CardTitle className="flex items-center gap-2">
                            <Filter className="h-5 w-5" />
                            Filtros
                        </CardTitle>
                    </CardHeader>
                    <CardContent>
                        <div className="flex flex-col md:flex-row gap-4">
                            <div className="flex-1">
                                <Label>Estado</Label>
                                <Select value={filterStatus} onValueChange={setFilterStatus}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todos</SelectItem>
                                        <SelectItem value="open">Abiertos</SelectItem>
                                        <SelectItem value="in_progress">En Progreso</SelectItem>
                                        <SelectItem value="resolved">Resueltos</SelectItem>
                                        <SelectItem value="closed">Cerrados</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div className="flex-1">
                                <Label>Categoría</Label>
                                <Select value={filterCategory} onValueChange={setFilterCategory}>
                                    <SelectTrigger>
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="all">Todas</SelectItem>
                                        {categories.map(cat => (
                                            <SelectItem key={cat.value} value={cat.value}>{cat.label}</SelectItem>
                                        ))}
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                    </CardContent>
                </Card>

                {/* Tickets List */}
                <Card>
                    <CardHeader>
                        <CardTitle>Tickets de Soporte</CardTitle>
                        <CardDescription>
                            {filteredTickets.length} ticket{filteredTickets.length !== 1 ? 's' : ''} encontrado{filteredTickets.length !== 1 ? 's' : ''}
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        {loading ? (
                            <div className="text-center py-8 text-muted-foreground">Cargando tickets...</div>
                        ) : filteredTickets.length > 0 ? (
                            <div className="space-y-3">
                                {filteredTickets.map((ticket) => (
                                    <div key={ticket.id} className="border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                                        <div className="flex items-start justify-between gap-4">
                                            <div className="flex-1 space-y-2">
                                                <div className="flex items-center gap-2">
                                                    {getStatusIcon(ticket.status)}
                                                    <h4 className="font-semibold">{ticket.subject}</h4>
                                                    {getPriorityBadge(ticket.priority)}
                                                </div>

                                                <p className="text-sm text-muted-foreground">
                                                    <span className="font-medium">{ticket.patient_name}</span> • {ticket.patient_email}
                                                </p>

                                                <p className="text-sm text-muted-foreground line-clamp-2">{ticket.message}</p>

                                                {ticket.admin_response && (
                                                    <div className="mt-2 p-3 bg-muted rounded-md">
                                                        <p className="text-sm font-medium mb-1">Tu respuesta:</p>
                                                        <p className="text-sm text-muted-foreground">{ticket.admin_response}</p>
                                                    </div>
                                                )}

                                                <div className="flex items-center gap-4 text-xs text-muted-foreground pt-2">
                                                    <span>Categoría: {categories.find(c => c.value === ticket.category)?.label}</span>
                                                    <span>•</span>
                                                    <span>{new Date(ticket.created_at).toLocaleString()}</span>
                                                </div>
                                            </div>

                                            <div className="flex flex-col gap-2">
                                                {getStatusBadge(ticket.status)}

                                                <Dialog>
                                                    <DialogTrigger asChild>
                                                        <Button size="sm" variant="outline" onClick={() => setSelectedTicket(ticket)}>
                                                            Responder
                                                        </Button>
                                                    </DialogTrigger>
                                                    <DialogContent>
                                                        <DialogHeader>
                                                            <DialogTitle>Responder Ticket</DialogTitle>
                                                            <DialogDescription>
                                                                Ticket de {ticket.patient_name}
                                                            </DialogDescription>
                                                        </DialogHeader>
                                                        <div className="space-y-4">
                                                            <div>
                                                                <Label>Consulta del paciente</Label>
                                                                <div className="mt-2 p-3 bg-muted rounded-md">
                                                                    <p className="text-sm font-medium mb-1">{ticket.subject}</p>
                                                                    <p className="text-sm text-muted-foreground">{ticket.message}</p>
                                                                </div>
                                                            </div>

                                                            <div>
                                                                <Label htmlFor="response">Tu respuesta</Label>
                                                                <Textarea
                                                                    id="response"
                                                                    rows={5}
                                                                    placeholder="Escribe tu respuesta aquí..."
                                                                    value={response}
                                                                    onChange={(e) => setResponse(e.target.value)}
                                                                />
                                                            </div>

                                                            <div className="flex gap-2">
                                                                <Button onClick={() => handleRespond(ticket.id)} className="flex-1">
                                                                    <Send className="h-4 w-4 mr-2" />
                                                                    Enviar Respuesta
                                                                </Button>
                                                                <Select onValueChange={(value) => handleStatusChange(ticket.id, value)}>
                                                                    <SelectTrigger className="w-[140px]">
                                                                        <SelectValue placeholder="Cambiar estado" />
                                                                    </SelectTrigger>
                                                                    <SelectContent>
                                                                        <SelectItem value="in_progress">En Progreso</SelectItem>
                                                                        <SelectItem value="resolved">Resuelto</SelectItem>
                                                                        <SelectItem value="closed">Cerrado</SelectItem>
                                                                    </SelectContent>
                                                                </Select>
                                                            </div>
                                                        </div>
                                                    </DialogContent>
                                                </Dialog>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-8 text-muted-foreground">
                                No hay tickets que coincidan con los filtros seleccionados
                            </div>
                        )}
                    </CardContent>
                </Card>
            </div>
        </AdminLayout>
    );
};

export default AdminSupport;
