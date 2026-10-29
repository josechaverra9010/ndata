/** Abre el diálogo de impresión del navegador con el contenido del plan (evita páginas en blanco por modales). */
export function triggerPatientPlanPrint(title = "Plan nutricional") {
  const root = document.querySelector(".patient-plan-print");
  if (!root) {
    window.print();
    return;
  }

  const prevTitle = document.title;
  document.title = title;

  const iframe = document.createElement("iframe");
  iframe.setAttribute("aria-hidden", "true");
  iframe.style.cssText =
    "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden;";
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  const win = iframe.contentWindow;
  if (!doc || !win) {
    document.title = prevTitle;
    iframe.remove();
    window.print();
    return;
  }

  const styles = Array.from(document.querySelectorAll('link[rel="stylesheet"]')).map(
    (el) => el.cloneNode(true) as HTMLElement
  );

  doc.open();
  doc.write("<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body></body></html>");
  doc.close();

  const head = doc.head;
  styles.forEach((node) => head.appendChild(node));

  const styleFix = doc.createElement("style");
  styleFix.textContent = `
    @page { margin: 12mm; }
    body { margin: 0; padding: 0; background: white; }
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
  `;
  head.appendChild(styleFix);

  const wrapper = doc.createElement("div");
  wrapper.className = "patient-plan-print";
  wrapper.innerHTML = root.innerHTML;
  doc.body.appendChild(wrapper);

  const cleanup = () => {
    document.title = prevTitle;
    iframe.remove();
    win.removeEventListener("afterprint", cleanup);
  };
  win.addEventListener("afterprint", cleanup);

  setTimeout(() => {
    win.focus();
    win.print();
    setTimeout(cleanup, 60_000);
  }, 400);
}
