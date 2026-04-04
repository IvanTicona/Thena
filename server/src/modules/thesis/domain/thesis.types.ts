export const DEFAULT_CHAPTERS = [
  'Perfil del Proyecto',
  'Marco Teórico',
  'Marco Práctico / Metodología',
  'Ingeniería del Proyecto',
  'Desarrollo e Implementación',
  'Pruebas y Resultados',
  'Conclusiones y Recomendaciones',
  'Anexos y Bibliografía',
] as const;

export interface CreateThesisPayload {
  title: string;
  tutorId?: string;
}

export interface UpdateThesisPayload {
  title?: string;
  tutorId?: string;
}
