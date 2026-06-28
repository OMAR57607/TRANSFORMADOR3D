/**
 * Contrato del dominio para la compresión de modelos 3D.
 * 
 * APLICA EL PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 * La compresión geométrica y optimización Draco es una fase aislada
 * del pipeline. Esta interfaz permite cambiar el algoritmo o biblioteca
 * de compresión (como Google Draco, gltf-transform o meshoptimizer)
 * de forma transparente.
 */
export interface IModelCompressor {
  /**
   * Optimiza y comprime un modelo GLB/GLTF crudo utilizando algoritmos como Draco.
   * @param rawModelPath Ruta del modelo 3D sin comprimir.
   * @returns La ruta o URL del modelo 3D comprimido final (.glb).
   */
  compress(rawModelPath: string): Promise<string>;
}
