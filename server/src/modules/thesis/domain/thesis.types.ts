export const DEFAULT_CHAPTERS = [
  'Marco Referencial',
  'Marco Teórico',
  'Marco Práctico',
  'Resultados',
  'Conclusiones',
  'Recomendaciones',
  'Bibliografía',
  'Anexos',
] as const;

export interface CreateThesisPayload {
  title: string;
  tutorId: string;
}

export interface UpdateThesisPayload {
  title?: string;
  tutorId?: string;
}
