import { useEffect } from "react";
import { useLocation } from "react-router-dom";
import AOS from "aos";
import "aos/dist/aos.css";

/**
 * Inicializa AOS (Animate On Scroll) y lo refresca en cada cambio de ruta.
 */
export function AosProvider() {
  const location = useLocation();

  useEffect(() => {
    AOS.init({
      duration: 750,
      easing: "ease-out-cubic",
      once: true,
      offset: 48,
      delay: 0,
      mirror: false,
      anchorPlacement: "top-bottom",
      disable: false,
      // Evita que AOS toque overlays fijos / pantallas de carga
      startEvent: "DOMContentLoaded",
    });
  }, []);

  useEffect(() => {
    // Esperar a que termine la transición de carga antes de refrescar AOS
    const t = window.setTimeout(() => {
      AOS.refresh();
    }, 320);
    return () => window.clearTimeout(t);
  }, [location.pathname, location.search]);

  return null;
}
