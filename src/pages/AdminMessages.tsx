import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { AdminLayout } from "@/layouts/AdminLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Search,
  Send,
  Paperclip,
  MoreVertical,
  Phone,
  Video,
  Check,
  CheckCheck,
  Clock,
  Image as ImageIcon,
  Plus
} from "lucide-react";
import { format, isToday, isYesterday } from "date-fns";
import { es } from "date-fns/locale";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"; // Add import
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  sender: "admin" | "patient";
  timestamp: string;
  status: "sent" | "delivered" | "read";
  type: "text" | "image" | "file";
}

interface Conversation {
  id: string;
  patientName: string;
  patientAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline: boolean;
  messages: Message[];
}

const mockConversations: Conversation[] = [
  {
    id: "1",
    patientName: "María García",
    lastMessage: "Gracias por la información del plan",
    lastMessageTime: new Date().toISOString(),
    unreadCount: 2,
    isOnline: true,
    messages: [
      { id: "1", content: "Hola doctora, ¿cómo está?", sender: "patient", timestamp: new Date(Date.now() - 3600000 * 2).toISOString(), status: "read", type: "text" },
      { id: "2", content: "¡Hola María! Muy bien, ¿en qué puedo ayudarte?", sender: "admin", timestamp: new Date(Date.now() - 3600000 * 1.5).toISOString(), status: "read", type: "text" },
      { id: "3", content: "Quería preguntarle sobre mi plan de alimentación", sender: "patient", timestamp: new Date(Date.now() - 3600000).toISOString(), status: "read", type: "text" },
      { id: "4", content: "Claro, te he actualizado el plan con más opciones de desayuno. Puedes verlo en la sección 'Mi Plan'", sender: "admin", timestamp: new Date(Date.now() - 1800000).toISOString(), status: "read", type: "text" },
      { id: "5", content: "Gracias por la información del plan", sender: "patient", timestamp: new Date().toISOString(), status: "read", type: "text" },
    ],
  },
  {
    id: "2",
    patientName: "Carlos López",
    lastMessage: "¿A qué hora es la cita?",
    lastMessageTime: new Date(Date.now() - 3600000).toISOString(),
    unreadCount: 1,
    isOnline: false,
    messages: [
      { id: "1", content: "Buenos días, ¿a qué hora es mi cita de mañana?", sender: "patient", timestamp: new Date(Date.now() - 3600000).toISOString(), status: "read", type: "text" },
    ],
  },
  {
    id: "3",
    patientName: "Ana Martínez",
    lastMessage: "Perfecto, nos vemos el lunes",
    lastMessageTime: new Date(Date.now() - 86400000).toISOString(),
    unreadCount: 0,
    isOnline: true,
    messages: [
      { id: "1", content: "Hola Ana, te confirmo la cita para el lunes a las 10:00", sender: "admin", timestamp: new Date(Date.now() - 86400000 - 3600000).toISOString(), status: "read", type: "text" },
      { id: "2", content: "Perfecto, nos vemos el lunes", sender: "patient", timestamp: new Date(Date.now() - 86400000).toISOString(), status: "read", type: "text" },
    ],
  },
  {
    id: "4",
    patientName: "Pedro Sánchez",
    lastMessage: "He seguido todas las indicaciones",
    lastMessageTime: new Date(Date.now() - 172800000).toISOString(),
    unreadCount: 0,
    isOnline: false,
    messages: [
      { id: "1", content: "Doctor, he seguido todas las indicaciones de esta semana", sender: "patient", timestamp: new Date(Date.now() - 172800000).toISOString(), status: "read", type: "text" },
    ],
  },
  {
    id: "5",
    patientName: "Laura Fernández",
    lastMessage: "¿Puedo comer frutos secos?",
    lastMessageTime: new Date(Date.now() - 259200000).toISOString(),
    unreadCount: 0,
    isOnline: false,
    messages: [
      { id: "1", content: "Hola, tengo una duda sobre mi dieta", sender: "patient", timestamp: new Date(Date.now() - 259200000 - 3600000).toISOString(), status: "read", type: "text" },
      { id: "2", content: "¿Puedo comer frutos secos?", sender: "patient", timestamp: new Date(Date.now() - 259200000).toISOString(), status: "read", type: "text" },
    ],
  },
];

export default function AdminMessages() {
  const navigate = useNavigate();
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [newChatOpen, setNewChatOpen] = useState(false);
  const [newMessage, setNewMessage] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000); // Polling for new lists
    return () => clearInterval(interval);
  }, []);

  // Handle URL params for deep linking
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const patientId = params.get("patientId");
    if (patientId && conversations.length > 0) {
      const targetConv = conversations.find(c => c.id === patientId);
      if (targetConv) {
        setSelectedConversation(targetConv);
      }
    }
  }, [conversations]);

  useEffect(() => {
    if (selectedConversation) {
      fetchMessages(selectedConversation.id);
      const interval = setInterval(() => fetchMessages(selectedConversation.id), 5000); // Polling for new messages
      return () => clearInterval(interval);
    }
  }, [selectedConversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [selectedConversation?.messages]);

  const fetchConversations = async () => {
    try {
      const token = localStorage.getItem("userToken");
      if (!token) return;
      console.log("Fetching conversations from:", `${API_URL}/messages/conversations`);
      const response = await fetch(`${API_URL}/messages/conversations`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      console.log("Conversations response status:", response.status);
      if (response.ok) {
        const data = await response.json();
        console.log("Conversations data received:", data);
        if (Array.isArray(data)) {
          setConversations(data.map((c: any) => ({
            ...c,
            id: String(c.id),
            messages: [] // Init empty
          })));
        } else {
          console.error("Data is not an array:", data);
          setConversations([]);
        }
      } else {
        const err = await response.text();
        console.error("Failed to fetch conversations:", err);
        setConversations([]);
      }
    } catch (error) {
      console.error("Error fetching conversations", error);
    }
  };

  const fetchMessages = async (userId: string) => {
    try {
      const token = localStorage.getItem("userToken");
      if (!token) return;
      const response = await fetch(`${API_URL}/messages/${userId}`, {
        headers: { "Authorization": `Bearer ${token}` }
      });
      if (response.ok) {
        const data = await response.json();
        const mapped: Message[] = (Array.isArray(data) ? data : []).map((m: any) => ({
          id: String(m.id),
          content: String(m.content ?? ""),
          sender: m.sender === "me" ? "admin" : "patient",
          timestamp: String(m.timestamp ?? ""),
          status: (m.status === "read" ? "read" : "sent"),
          type: (m.type === "image" || m.type === "file" ? m.type : "text"),
        }));

        // Update the selected conversation with these messages
        setSelectedConversation(prev => prev ? { ...prev, messages: mapped } : null);
      }
    } catch (error) {
      console.error("Error fetching messages", error);
    }
  }

  const formatMessageTime = (date: string) => {
    if (!date) return "";
    const d = new Date(date);
    if (isToday(d)) {
      return format(d, "HH:mm");
    } else if (isYesterday(d)) {
      return "Ayer";
    } else {
      return format(d, "dd/MM/yyyy");
    }
  };

  const formatChatTime = (date: string) => {
    if (!date) return "";
    return format(new Date(date), "HH:mm");
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation) return;

    try {
      const token = localStorage.getItem("userToken");
      const response = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`
        },
        body: JSON.stringify({
          receiver_id: parseInt(selectedConversation.id),
          content: newMessage,
          type: "text"
        })
      });

      if (response.ok) {
        const data = await response.json();
        const newMsg: Message = {
          id: String(data.id),
          content: newMessage,
          sender: "admin",
          timestamp: String(data.timestamp ?? new Date().toISOString()),
          status: "sent",
          type: "text",
        };

        setSelectedConversation(prev => prev ? {
          ...prev,
          messages: [...prev.messages, newMsg],
          lastMessage: newMessage,
          lastMessageTime: String(data.timestamp ?? new Date().toISOString())
        } : null);
        setNewMessage("");
        fetchConversations(); // Update list order
      }
    } catch (error) {
      toast({ title: "Error al enviar mensaje", variant: "destructive" });
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  const filteredConversations = conversations.filter(conv =>
    conv.patientName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const getMessageStatusIcon = (status: string) => {
    switch (status) {
      case "sent":
        return <Check className="h-3 w-3 text-muted-foreground" />;
      case "delivered":
        return <CheckCheck className="h-3 w-3 text-muted-foreground" />;
      case "read":
        return <CheckCheck className="h-3 w-3 text-primary" />;
      default:
        return <Clock className="h-3 w-3 text-muted-foreground" />;
    }
  };

  return (
    <AdminLayout>
      <div className="h-[calc(100vh-theme(spacing.32))]">
        <div className="mb-6">
          <h1 className="text-3xl font-bold text-foreground">Mensajes</h1>
          <p className="text-muted-foreground">Comunícate con tus pacientes</p>
        </div>

        <div className="grid h-[calc(100%-5rem)] grid-cols-[350px_1fr] gap-4">
          {/* Conversations List */}
          <Card className="flex flex-col">
            <CardHeader className="pb-3">
              <div className="flex items-center gap-2 mb-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    placeholder="Buscar..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
                <Button size="icon" onClick={() => setNewChatOpen(true)}>
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full">
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((conversation) => (
                    <div
                      key={conversation.id}
                      className={`flex cursor-pointer items-start gap-3 border-b p-4 transition-colors hover:bg-muted/50 ${selectedConversation?.id === conversation.id ? "bg-muted" : ""
                        }`}
                      onClick={() => {
                        setSelectedConversation(conversation);
                        // Mark as read
                        setConversations(prev => prev.map(conv =>
                          conv.id === conversation.id ? { ...conv, unreadCount: 0 } : conv
                        ));
                      }}
                    >
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={conversation.patientAvatar} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {conversation.patientName ? conversation.patientName.split(" ").map(n => n[0]).join("") : "P"}
                          </AvatarFallback>
                        </Avatar>
                        {conversation.isOnline && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                        )}
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="font-medium">{conversation.patientName}</span>
                          <span className="text-xs text-muted-foreground">
                            {formatMessageTime(conversation.lastMessageTime)}
                          </span>
                        </div>
                        <div className="flex items-center justify-between">
                          <p className="truncate text-sm text-muted-foreground">
                            {conversation.lastMessage}
                          </p>
                          {conversation.unreadCount > 0 && (
                            <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                              {conversation.unreadCount}
                            </Badge>
                          )}
                        </div>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No hay pacientes disponibles
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat Area */}
          <Card className="flex flex-col">
            {selectedConversation ? (
              <>
                {/* Chat Header */}
                <CardHeader className="border-b pb-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="relative">
                        <Avatar>
                          <AvatarImage src={selectedConversation.patientAvatar} />
                          <AvatarFallback className="bg-primary/10 text-primary">
                            {selectedConversation.patientName.split(" ").map(n => n[0]).join("")}
                          </AvatarFallback>
                        </Avatar>
                        {selectedConversation.isOnline && (
                          <span className="absolute bottom-0 right-0 h-3 w-3 rounded-full border-2 border-background bg-green-500" />
                        )}
                      </div>
                      <div>
                        <CardTitle className="text-lg">{selectedConversation.patientName}</CardTitle>
                        <p className="text-sm text-muted-foreground">
                          {selectedConversation.isOnline ? "En línea" : "Desconectado"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toast({ title: "Iniciando llamada..." })}
                      >
                        <Phone className="h-5 w-5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => toast({ title: "Iniciando videollamada..." })}
                      >
                        <Video className="h-5 w-5" />
                      </Button>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="icon">
                            <MoreVertical className="h-5 w-5" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onClick={() => navigate(`/progress?patientId=${selectedConversation.id}`)}>
                            Ver perfil
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => navigate("/appointments")}>
                            Agendar cita
                          </DropdownMenuItem>
                          <DropdownMenuItem onClick={() => toast({ title: "Archivando conversación..." })}>
                            Archivar conversación
                          </DropdownMenuItem>
                          <DropdownMenuItem className="text-destructive">
                            Eliminar conversación
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full p-4">
                    <div className="space-y-4">
                      {selectedConversation.messages.map((message) => (
                        <div
                          key={message.id}
                          className={`flex ${message.sender === "admin" ? "justify-end" : "justify-start"}`}
                        >
                          <div
                            className={`max-w-[70%] rounded-2xl px-4 py-2 ${message.sender === "admin"
                              ? "bg-primary text-primary-foreground rounded-br-md"
                              : "bg-muted rounded-bl-md"
                              }`}
                          >
                            <p className="text-sm">{message.content}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${message.sender === "admin" ? "text-primary-foreground/70" : "text-muted-foreground"
                              }`}>
                              <span className="text-xs">{formatChatTime(message.timestamp)}</span>
                              {message.sender === "admin" && getMessageStatusIcon(message.status)}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>

                {/* Message Input */}
                <div className="border-t p-4">
                  <div className="flex items-center gap-2">
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toast({ title: "Adjuntar archivo" })}
                    >
                      <Paperclip className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => toast({ title: "Enviar imagen" })}
                    >
                      <ImageIcon className="h-5 w-5" />
                    </Button>
                    <Input
                      placeholder="Escribe un mensaje..."
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyPress={handleKeyPress}
                      className="flex-1"
                    />
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      className="gradient-primary text-primary-foreground"
                    >
                      <Send className="h-5 w-5" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center">
                <div className="text-center text-muted-foreground">
                  <MessageSquareIcon className="mx-auto h-16 w-16 opacity-50" />
                  <p className="mt-4 text-lg font-medium">Selecciona una conversación</p>
                  <p className="text-sm">Elige un paciente para comenzar a chatear</p>
                </div>
              </div>
            )}
          </Card>
        </div>
      </div>


      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Iniciar nueva conversación</DialogTitle>
          </DialogHeader>
          <ScrollArea className="h-[300px]">
            <div className="space-y-2">
              {conversations.length > 0 ? (
                conversations.map((conv) => (
                  <div
                    key={conv.id}
                    className="flex items-center gap-3 p-2 hover:bg-muted rounded-md cursor-pointer"
                    onClick={() => {
                      setSelectedConversation(conv);
                      setNewChatOpen(false);
                    }}
                  >
                    <Avatar>
                      <AvatarImage src={conv.patientAvatar} />
                      <AvatarFallback>{conv.patientName ? conv.patientName.substring(0, 2).toUpperCase() : "P"}</AvatarFallback>
                    </Avatar>
                    <span className="font-medium">{conv.patientName}</span>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-muted-foreground">
                  No hay pacientes disponibles para iniciar conversación
                </div>
              )}
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </AdminLayout >
  );
}

function MessageSquareIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}