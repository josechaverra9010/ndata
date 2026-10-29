/** Fecha ISO en zona Colombia (UTC-5) */
export function todayInColombiaISO(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const co = new Date(utc - 5 * 3600000);
  return co.toISOString().slice(0, 10);
}

export function todayLabelColombia(): string {
  return new Date().toLocaleDateString('es-CO', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    timeZone: 'America/Bogota',
  });
}
