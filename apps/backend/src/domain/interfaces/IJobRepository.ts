/**
 * Estados del flujo de procesamiento en el backend.
 */
export type ReconstructionStatus = 
  | 'PENDING' 
  | 'DOWNLOADING' 
  | 'RECONSTRUCTING' 
  | 'COMPRESSING' 
  | 'COMPLETED' 
  | 'FAILED';

/**
 * Entidad que representa una tarea de reconstrucción 3D en el sistema.
 */
export interface ReconstructionJob {
  jobId: string;
  vehicleId: string;
  rawCaptureUrl: string;
  status: ReconstructionStatus;
  progressPercentage: number;
  modelUrl?: string;
  error?: string;
  logs?: string[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Contrato de repositorio para gestionar la persistencia y estado de las tareas.
 * 
 * APLICA EL PRINCIPIO DE INVERSIÓN DE DEPENDENCIAS (DIP):
 * Las reglas de negocio interactúan con este repositorio sin saber si la persistencia
 * se realiza en memoria, en una base de datos PostgreSQL, un clúster MongoDB o una cola Redis.
 */
export interface IJobRepository {
  /**
   * Guarda o actualiza una tarea de reconstrucción en el medio de almacenamiento.
   */
  save(job: ReconstructionJob): Promise<void>;

  /**
   * Busca una tarea de reconstrucción por su identificador único.
   */
  findById(jobId: string): Promise<ReconstructionJob | null>;
}
