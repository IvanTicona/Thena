/**
 * Formats a date string as a short date (day, abbreviated month, year).
 * Used in list views where space is limited.
 */
export function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  });
}

/**
 * Formats a date string as a full date + time.
 * Used in detail views where full timestamp context is valuable.
 */
export function formatDateTime(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('es-BO', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/**
 * Returns a human-readable relative time string in Spanish.
 * Examples: "hace un momento", "hace 3 horas", "hace 2 días".
 */
export function timeAgo(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;

  const seconds = Math.floor(diffMs / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return formatDate(dateStr);
  if (days > 1) return `hace ${days} días`;
  if (days === 1) return 'ayer';
  if (hours > 1) return `hace ${hours} horas`;
  if (hours === 1) return 'hace 1 hora';
  if (minutes > 1) return `hace ${minutes} minutos`;
  return 'hace un momento';
}
