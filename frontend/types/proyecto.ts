/** Modelo alineado con `/proyectos` (API + cartelera). */

export interface Puesto {
  id: number | string;
  nombre: string;
}

export interface ProyectoUser {
  nombre?: string;
}

export interface Proyecto {
  id: number;
  titulo: string;
  descripcion: string;
  tipo: string;
  ciudad: string;
  esEstudiante: boolean;
  esRemunerado: boolean;
  fechaInicio?: string;
  foto?: string;
  fotoProfundidad?: string | null;
  galeria?: string[];
  referencias?: string[];
  puestos?: Puesto[];
  user?: ProyectoUser;
}
