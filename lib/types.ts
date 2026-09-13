// Tipos centrales de la aplicación Carretes Valparaíso & V Región

export type Categoria =
  | 'universitario'
  | 'under'
  | 'electronica'
  | 'cumbia'
  | 'reggaeton'
  | 'rock'
  | 'otro';

export type FuenteEvento = 'instagram' | 'facebook' | 'google' | 'passline' | 'manual';

export interface Evento {
  id: string;
  nombre: string;
  descripcion?: string | null;
  fecha: string; // ISO date string YYYY-MM-DD
  hora?: string | null; // HH:MM
  lugar?: string | null;
  ciudad: string;
  sector?: string | null;
  precio: number; // CLP. Sólo interpretar 0 como gratis si precio_conocido !== false.
  precio_conocido?: boolean;
  precio_texto?: string | null;
  categoria: Categoria;
  imagen_url?: string | null;
  fuente: FuenteEvento;
  fuente_url?: string | null;
  organizador?: string | null;
  organizador_url?: string | null;
  verificado: boolean;
  destacado?: boolean;
  activo: boolean;
  asistentes_interesados?: number;
  tags?: string[];
  ubicacion?: {
    lat: number;
    lng: number;
  };
  created_at: string;
}

export interface EventoFormData {
  nombre: string;
  descripcion: string;
  fecha: string;
  hora: string;
  lugar: string;
  ciudad: string;
  sector?: string;
  precio: number | '';
  precio_texto?: string;
  categoria: Categoria;
  organizador: string;
  organizador_url?: string;
  fuente_url?: string;
  imagen_url?: string;
  tags?: string;
}

export interface FiltrosEvento {
  busqueda?: string;
  categoria?: Categoria | 'todos';
  ciudad?: string | 'todos';
  precio?: 'gratis' | 'pago' | 'todos';
  fecha?: 'hoy' | 'finde' | 'futuro' | 'semana' | 'todos';
}

export const CATEGORIAS: {
  value: Categoria;
  label: string;
  emoji: string;
  badgeClass: string;
  desc: string;
}[] = [
  { value: 'under', label: 'Joyitas & Under', emoji: '💎', badgeClass: 'badge-under', desc: 'Spots secretos, raves, tocatas punk y arte under' },
  { value: 'electronica', label: 'Electrónica & Techno', emoji: '🎧', badgeClass: 'badge-electronica', desc: 'Techno, House, Psy, D&B y sets extendidos' },
  { value: 'rock', label: 'Rock & Tocatas', emoji: '🎸', badgeClass: 'badge-rock', desc: 'Bandas en vivo, punk, post-punk e indie' },
  { value: 'universitario', label: 'Universitarios', emoji: '🎓', badgeClass: 'badge-universitario', desc: 'Mechoneos, PUCV, UV, USM, UPLA y fiestas universitarias' },
  { value: 'cumbia', label: 'Cumbia & Pachanga', emoji: '🪗', badgeClass: 'badge-cumbia', desc: 'Salsa, cumbia porteña y fiesta costera' },
  { value: 'reggaeton', label: 'Reggaetón & Perreo', emoji: '🔥', badgeClass: 'badge-reggaeton', desc: 'Bellakeo, old school, trap y discotecas' },
  { value: 'otro', label: 'Otros Eventos', emoji: '🎉', badgeClass: 'badge-otro', desc: 'Ferias nocturnas, acústicos y arte' },
];

export const CIUDADES = [
  'Valparaíso',
  'Viña del Mar',
  'Reñaca',
  'Quilpué',
  'Villa Alemana',
  'Concón',
];

export const SECTORES_POPULARES: Record<string, string[]> = {
  Valparaíso: ['Subida Ecuador', 'Barrio Puerto', 'Cerro Alegre & Concepción', 'Aníbal Pinto', 'Muelle Barón', 'Avenida Brasil'],
  'Viña del Mar': ['Población Vergara', '1 Norte & San Martín', 'Sporting Club', 'Recreo', 'Miramar'],
  Reñaca: ['Sector 5', 'Avenida Borgoño', 'Los Ositos'],
  Quilpué: ['Centro / Cumming', 'Plaza Vieja', 'Carampangue'],
};

export const HOTSPOTS_COORDENADAS: Record<string, { lat: number; lng: number; descripcion: string }> = {
  'Subida Ecuador, Valparaíso': { lat: -33.0487, lng: -71.6212, descripcion: 'Epicentro del carrete bohemio y universitario de Valparaíso' },
  'Muelle Barón, Valparaíso': { lat: -33.0401, lng: -71.6046, descripcion: 'Galpones y tocatas frente al mar' },
  'Barrio Puerto / Sotomayor': { lat: -33.0384, lng: -71.6288, descripcion: 'Fiestas under, cantinas clásicas y post-punk' },
  'Cerro Concepción & Alegre': { lat: -33.0435, lng: -71.6276, descripcion: 'Bares, acústicos y terrazas con vista' },
  'Reñaca Sector 5': { lat: -32.9734, lng: -71.5435, descripcion: 'Discotecas playeras, sunsets y fiestas de verano' },
  'Población Vergara, Viña del Mar': { lat: -33.0185, lng: -71.5512, descripcion: 'Bares, pubs y previa viñamarina' },
  'Trotamundos / Quilpué Centro': { lat: -33.0456, lng: -71.4429, descripcion: 'Trotamundos, tocatas nacionales y fiesta' },
};
