const formato = new Intl.DateTimeFormat('pt-MZ', {
  weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
});

export const formatarData = (iso: string | null) => (iso ? formato.format(new Date(iso)) : null);

/** ISO -> valor para <input type="datetime-local"> na hora local */
export function paraInputLocal(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
}

export const deInputLocal = (valor: string) => (valor ? new Date(valor).toISOString() : null);
