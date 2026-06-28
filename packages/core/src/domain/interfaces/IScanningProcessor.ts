/**
 * Estados posibles del procesamiento de reconstrucción 3D.
 */
export type ScanStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED';

/**
 * Información sobre el estado de un trabajo de escaneo 3D.
 */
export interface ScanJob {
  jobId: string;
  status: ScanStatus;
  progressPercentage: number;
  modelUrl?: string; // URL del modelo optimizado (.glb/.gltf)
  error?: string;
}

/**
 * Contrato de dominio para el procesador de escaneo 3D.
 * 
 * APLICA EL PRINCIPIO DE INVERSIÓN DE DEPENDENCIAS (DIP):
 * La lógica de negocio de la aplicación dependerá únicamente de este contrato,
 * y no de implementaciones concretas como Luma API o pipelines propietarios.
 * 
 * APLICA EL PRINCIPIO ABIERTO/CERRADO (OCP):
 * Si en el futuro cambiamos a un pipeline local de Gaussian Splatting, simplemente
 * crearemos una nueva clase de infraestructura que implemente esta interfaz sin alterar
 * los casos de uso existentes.
 */
export interface IScanningProcessor {
  /**
   * Inicia el proceso de reconstrucción 3D a partir de un paquete de imágenes o video.
   * @param sourceUrl URL del video o del paquete ZIP de imágenes subido.
   * @returns Un objeto ScanJob inicializado.
   */
  startScan(sourceUrl: string): Promise<ScanJob>;

  /**
   * Consulta el estado de un trabajo de escaneo en progreso.
   * @param jobId Identificador del trabajo de escaneo.
   * @returns Un objeto ScanJob con el estado actual.
   */
  getScanStatus(jobId: string): Promise<ScanJob>;
}
