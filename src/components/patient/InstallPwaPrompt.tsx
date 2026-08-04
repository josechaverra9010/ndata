import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button";

import { Download, X } from "lucide-react";

import { fetchPatientFeatureFlags } from "@/lib/featureFlags";



interface BeforeInstallPromptEvent extends Event {

  prompt: () => Promise<void>;

  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;

}



export function InstallPwaPrompt() {

  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);

  const [dismissed, setDismissed] = useState(false);

  const [pwaEnabled, setPwaEnabled] = useState(true);



  useEffect(() => {

    const token = localStorage.getItem("userToken");

    fetchPatientFeatureFlags(token).then((flags) => {

      setPwaEnabled(flags.pwa_offline !== false);

    });

  }, []);



  useEffect(() => {

    const dismissedLocal = localStorage.getItem("pwa-install-dismissed");

    if (dismissedLocal) setDismissed(true);



    const handler = (e: Event) => {

      e.preventDefault();

      setDeferred(e as BeforeInstallPromptEvent);

    };

    window.addEventListener("beforeinstallprompt", handler);

    return () => window.removeEventListener("beforeinstallprompt", handler);

  }, []);



  if (!pwaEnabled || !deferred || dismissed) return null;



  const install = async () => {

    await deferred.prompt();

    const choice = await deferred.userChoice;

    if (choice.outcome === "accepted") setDeferred(null);

  };



  const dismiss = () => {

    localStorage.setItem("pwa-install-dismissed", "1");

    setDismissed(true);

    setDeferred(null);

  };



  return (

    <div className="fixed bottom-20 lg:bottom-6 left-4 right-4 lg:left-auto lg:right-6 lg:max-w-sm z-50 rounded-2xl border border-primary/30 bg-card shadow-lg p-4">

      <div className="flex items-start justify-between gap-2 mb-2">

        <p className="font-semibold text-sm">Instala NutriData</p>

        <button type="button" onClick={dismiss} className="text-muted-foreground hover:text-foreground">

          <X className="h-4 w-4" />

        </button>

      </div>

      <p className="text-xs text-muted-foreground mb-3">

        Acceso rápido desde tu pantalla de inicio, como una app nativa.

      </p>

      <Button size="sm" className="w-full gap-2 rounded-full" onClick={install}>

        <Download className="h-4 w-4" />

        Instalar app

      </Button>

    </div>

  );

}

