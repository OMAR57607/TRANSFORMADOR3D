/**
 * Contrato del dominio para el motor de reconstrucción 3D (Photogrammetry / Gaussian Splatting).
 * 
 * APLICA EL PRINCIPIO DE INVERSIÓN DE DEPENDENCIAS (DIP):
 * El backend puede cambiar el motor de reconstrucción física (de un script COLMAP local
 * a Nerfstudio o 3D Gaussian Splatting en la nube/servidores GPU dedicados) sin modificar
 * la lógica de negocio del caso de uso principal.
 */
export interface IReconstructionEngine {
  /**
   * Ejecuta el pipeline de reconstrucción 3D a partir de un video o zip de imágenes de origen.
   * @param rawCaptureUrl URL o ruta local del video/archivo ZIP de origen.
   * @param jobId ID único del trabajo para organizar los archivos temporales y la salida.
   * @returns La ruta o URL local del modelo 3D GLB/GLTF crudo generado.
   */
  runReconstruction(rawCaptureUrl: string, jobId: string): Promise<string>;
}
