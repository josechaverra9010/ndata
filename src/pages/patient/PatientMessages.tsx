import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { PatientLayout } from "@/layouts/PatientLayout";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Send, Paperclip, Image, Smile, Check, CheckCheck, Search } from "lucide-react";
import { API_URL } from "@/config/api";
import { useToast } from "@/hooks/use-toast";

interface Message {
  id: string;
  content: string;
  sender: "patient" | "doctor";
  timestamp: string;
  status: "sent" | "read";
  type: "text" | "image" | "file";
}

interface Conversation {
  id: string;
  doctorName: string;
  doctorAvatar?: string;
  lastMessage: string;
  lastMessageTime: string;
  unreadCount: number;
  isOnline?: boolean;
}

export default function PatientMessages() {
  const { user } = useAuth();
  const { toast } = useToast();
  const [newMessage, setNewMessage] = useState("");
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [selectedConversation, setSelectedConversation] = useState<Conversation | null>(null);
  const [messages, setMessages] = useState<Message[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const token = localStorage.getItem("userToken");

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const fetchConversations = async () => {
    if (!token) return;
    console.log("Fetching conversations (Patient view) from:", `${API_URL}/messages/conversations`);
    try {
      const res = await fetch(`${API_URL}/messages/conversations`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      console.log("Conversations response status:", res.status);
      if (!res.ok) {
        console.error("Failed to fetch conversations (status not ok)");
        return;
      }
      const data = await res.json();
      console.log("Conversations data (mapped):", data);
      const mapped: Conversation[] = (Array.isArray(data) ? data : []).map((c: any) => ({
        id: String(c.id),
        doctorName: String(c.patientName ?? ""),
        doctorAvatar: c.patientAvatar || undefined,
        lastMessage: String(c.lastMessage ?? ""),
        lastMessageTime: String(c.lastMessageTime ?? ""),
        unreadCount: Number(c.unreadCount ?? 0),
        isOnline: Boolean(c.isOnline ?? false),
      }));
      setConversations(mapped);
      if (!selectedConversation && mapped.length > 0) {
        setSelectedConversation(mapped[0]);
      }
    } catch (e) {
      console.error("Error in fetchConversations:", e);
    }
  };

  const fetchMessages = async (otherUserId: string) => {
    if (!token) return;
    try {
      const res = await fetch(`${API_URL}/messages/${otherUserId}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (!res.ok) return;
      const data = await res.json();
      const mapped: Message[] = (Array.isArray(data) ? data : []).map((m: any) => ({
        id: String(m.id),
        content: String(m.content ?? ""),
        sender: m.sender === "me" ? "patient" : "doctor",
        timestamp: String(m.timestamp ?? ""),
        status: m.status === "read" ? "read" : "sent",
        type: (m.type === "image" || m.type === "file" ? m.type : "text"),
      }));
      setMessages(mapped);
      // Al abrir un chat, refrescar lista para limpiar unreadCount
      fetchConversations();
    } catch (e) {
      console.error(e);
    }
  };

  const handleSendMessage = async () => {
    if (!newMessage.trim() || !selectedConversation || !token) return;
    try {
      const res = await fetch(`${API_URL}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          receiver_id: parseInt(selectedConversation.id),
          content: newMessage,
          type: "text",
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setMessages((prev) => [
        ...prev,
        {
          id: String(data.id ?? Date.now()),
          content: newMessage,
          sender: "patient",
          timestamp: String(data.timestamp ?? new Date().toISOString()),
          status: "sent",
          type: "text",
        },
      ]);
      setNewMessage("");
      fetchConversations();
      scrollToBottom();
    } catch {
      toast({ title: "Error", description: "No se pudo enviar el mensaje", variant: "destructive" });
    }
  };

  useEffect(() => {
    fetchConversations();
    const interval = setInterval(fetchConversations, 10000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!selectedConversation) return;
    fetchMessages(selectedConversation.id);
    const interval = setInterval(() => fetchMessages(selectedConversation.id), 5000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedConversation?.id]);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const filteredConversations = conversations.filter((c) =>
    c.doctorName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  return (
    <PatientLayout>
      <div className="animate-fade-in h-[calc(100vh-10rem)] lg:h-[calc(100vh-8rem)]">
        <div className="grid h-full grid-cols-[320px_1fr] gap-4">
          {/* Conversations */}
          <Card className="flex flex-col border-border shadow-card">
            <CardHeader className="pb-3">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-10"
                />
              </div>
            </CardHeader>
            <CardContent className="flex-1 p-0">
              <ScrollArea className="h-full">
                {filteredConversations.length > 0 ? (
                  filteredConversations.map((c) => (
                    <div
                      key={c.id}
                      className={`flex cursor-pointer items-start gap-3 border-b p-4 transition-colors hover:bg-muted/50 ${selectedConversation?.id === c.id ? "bg-muted" : ""}`}
                      onClick={() => setSelectedConversation(c)}
                    >
                      <Avatar className="h-8 w-8 lg:h-10 lg:w-10 border-2 border-primary/20">
                        <AvatarImage src={c.doctorAvatar} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {c.doctorName ? c.doctorName.split(" ").map((n) => n[0]).join("") : "N"}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 overflow-hidden">
                        <div className="flex items-center justify-between">
                          <span className="font-medium truncate">{c.doctorName}</span>
                          {c.unreadCount > 0 && (
                            <Badge className="ml-2 h-5 w-5 rounded-full p-0 text-xs">
                              {c.unreadCount}
                            </Badge>
                          )}
                        </div>
                        <p className="truncate text-sm text-muted-foreground">{c.lastMessage}</p>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="p-4 text-center text-muted-foreground">
                    No hay profesionales disponibles
                  </div>
                )}
              </ScrollArea>
            </CardContent>
          </Card>

          {/* Chat */}
          <Card className="border-border shadow-card h-full flex flex-col">
            {selectedConversation ? (
              <>
                <CardHeader className="border-b border-border py-3 lg:py-4 px-3 lg:px-6">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 lg:gap-3">
                      <Avatar className="h-8 w-8 lg:h-10 lg:w-10 border-2 border-primary/20">
                        <AvatarImage src={selectedConversation.doctorAvatar} />
                        <AvatarFallback className="bg-primary text-primary-foreground text-xs lg:text-sm">
                          {selectedConversation.doctorName.split(" ").map((n) => n[0]).join("")}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-sm lg:text-base">{selectedConversation.doctorName}</CardTitle>
                        <div className="flex items-center gap-1 lg:gap-2">
                          <span className={`h-1.5 w-1.5 lg:h-2 lg:w-2 rounded-full ${selectedConversation.isOnline ? "bg-success" : "bg-muted-foreground"}`} />
                          <span className="text-[10px] lg:text-xs text-muted-foreground">
                            {selectedConversation.isOnline ? "En línea" : "Desconectado"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="text-[10px] lg:text-xs hidden sm:flex">Tu Nutricionista</Badge>
                  </div>
                </CardHeader>

                <CardContent className="flex-1 overflow-hidden p-0">
                  <ScrollArea className="h-full p-4">
                    <div className="space-y-4">
                      {messages.map((msg) => (
                        <div key={msg.id} className={`flex ${msg.sender === "patient" ? "justify-end" : "justify-start"}`}>
                          <div className={`max-w-[70%] rounded-2xl px-4 py-2 ${msg.sender === "patient" ? "bg-primary text-primary-foreground rounded-br-md" : "bg-muted rounded-bl-md"}`}>
                            <p className="text-sm">{msg.content}</p>
                            <div className={`flex items-center justify-end gap-1 mt-1 ${msg.sender === "patient" ? "text-primary-foreground/70" : "text-muted-foreground"}`}>
                              <span className="text-xs">{new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                              {msg.sender === "patient" && (msg.status === "read" ? <CheckCheck className="h-3 w-3" /> : <Check className="h-3 w-3" />)}
                            </div>
                          </div>
                        </div>
                      ))}
                      <div ref={messagesEndRef} />
                    </div>
                  </ScrollArea>
                </CardContent>

                <div className="border-t border-border p-2 lg:p-4">
                  <div className="flex items-center gap-1 lg:gap-2">
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 lg:h-10 lg:w-10">
                      <Paperclip className="h-4 w-4 lg:h-5 lg:w-5" />
                    </Button>
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 lg:h-10 lg:w-10 hidden sm:flex">
                      <Image className="h-4 w-4 lg:h-5 lg:w-5" />
                    </Button>
                    <Input
                      value={newMessage}
                      onChange={(e) => setNewMessage(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && handleSendMessage()}
                      className="flex-1 bg-muted/50 border-0 text-sm h-9 lg:h-10"
                    />
                    <Button variant="ghost" size="icon" className="text-muted-foreground hover:text-foreground h-8 w-8 lg:h-10 lg:w-10 hidden sm:flex">
                      <Smile className="h-4 w-4 lg:h-5 lg:w-5" />
                    </Button>
                    <Button
                      onClick={handleSendMessage}
                      disabled={!newMessage.trim()}
                      size="icon"
                      className="gradient-primary shadow-glow h-8 w-8 lg:h-10 lg:w-10"
                    >
                      <Send className="h-3 w-3 lg:h-4 lg:w-4" />
                    </Button>
                  </div>
                </div>
              </>
            ) : (
              <div className="flex flex-1 items-center justify-center text-muted-foreground">
                Selecciona un profesional para contactar
              </div>
            )}
          </Card>
        </div>
      </div>
    </PatientLayout>
  );
}
