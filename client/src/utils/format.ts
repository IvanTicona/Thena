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
