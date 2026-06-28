/**
 * Opciones para personalizar el comportamiento de la subida de archivos.
 */
export interface UploadOptions {
  /**
   * Callback para recibir notificaciones del progreso de la subida (de 0 a 100).
   */
  onProgress?: (progress: number) => void;

  /**
   * Número máximo de reintentos en caso de fallos de red temporales.
   */
  maxRetries?: number;

  /**
   * Tiempo base de espera (en milisegundos) antes del primer reintento para el backoff exponencial.
   */
  initialDelayMs?: number;
}

/**
 * Contrato de dominio para la subida resiliente de archivos.
 * 
 * APLICA EL PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 * Se aísla por completo el transporte de datos físicos (imágenes, videos)
 * de la lógica de procesamiento 3D y de los componentes visuales de presentación.
 * 
 * APLICA LA RESILIENCIA DE RED:
 * El contrato define opciones para configurar reintentos con retroceso exponencial,
 * asegurando la tolerancia a fallos en conexiones móviles inestables.
 */
export interface IFileUploader {
  /**
   * Sube un archivo local al almacenamiento persistente.
   * @param localFilePath Ruta del archivo local en el dispositivo del usuario.
   * @param options Opciones de subida que controlan el progreso y la tolerancia a fallos.
   * @returns La URL pública o privada donde quedó almacenado el recurso.
   */
  uploadFile(localFilePath: string, options?: UploadOptions): Promise<string>;
}
