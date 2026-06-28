import { IJobRepository } from '../../domain/interfaces/IJobRepository';
import { IReconstructionEngine } from '../../domain/interfaces/IReconstructionEngine';
import { IModelCompressor } from '../../domain/interfaces/IModelCompressor';

/**
 * Caso de Uso: Procesar Trabajo de Reconstrucción (ProcessReconstructionJob)
 * 
 * APLICA EL PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 * Este caso de uso se encarga exclusivamente de la orquestación del flujo de procesamiento
 * de backend (descarga -> reconstrucción 3D -> compresión Draco -> persistencia).
 * 
 * APLICA LA INVERSIÓN DE DEPENDENCIAS (DIP):
 * Coordina múltiples servicios mediante sus interfaces del dominio, aislando por completo
 * la orquestación de los detalles del sistema operativo, de la GPU o de la base de datos física.
 */
export class ProcessReconstructionJob {
  constructor(
    private readonly jobRepository: IJobRepository,
    private readonly reconstructionEngine: IReconstructionEngine,
    private readonly modelCompressor: IModelCompressor
  ) {}

  /**
   * Ejecuta secuencialmente el pipeline 3D para una tarea específica.
   * Actualiza el estado y progreso en cada fase de la base de datos.
   * @param jobId ID único de la tarea a procesar.
   */
  async execute(jobId: string): Promise<void> {
    const job = await this.jobRepository.findById(jobId);
    if (!job) {
      console.error(`[ProcessReconstructionJob] La tarea con ID "${jobId}" no existe.`);
      return;
    }

    try {
      console.log(`[ProcessReconstructionJob] [${jobId}] Iniciando procesamiento del vehículo: ${job.vehicleId}`);

      // --- FASE 1: DESCARGA ---
      job.status = 'DOWNLOADING';
      job.progressPercentage = 10;
      job.updatedAt = new Date();
      await this.jobRepository.save(job);
      console.log(`[ProcessReconstructionJob] [${jobId}] Descargando archivos capturados... (10%)`);
      await this.sleep(1000); // Simulación de descarga

      // --- FASE 2: RECONSTRUCCIÓN 3D (COLMAP / Gaussian Splatting) ---
      job.status = 'RECONSTRUCTING';
      job.progressPercentage = 30;
      job.updatedAt = new Date();
      await this.jobRepository.save(job);
      console.log(`[ProcessReconstructionJob] [${jobId}] Ejecutando pipeline de reconstrucción 3D (3DGS)... (30%)`);
      
      // Llamada al motor de reconstrucción desacoplado
      const rawModelPath = await this.reconstructionEngine.runReconstruction(job.rawCaptureUrl, job.jobId);
      job.progressPercentage = 70;
      await this.jobRepository.save(job);
      await this.sleep(500);

      // --- FASE 3: COMPRESIÓN DRACO Y OPTIMIZACIÓN ---
      job.status = 'COMPRESSING';
      job.progressPercentage = 75;
      job.updatedAt = new Date();
      await this.jobRepository.save(job);
      console.log(`[ProcessReconstructionJob] [${jobId}] Optimizando malla y aplicando compresión Draco... (75%)`);

      // Llamada al compresor Draco desacoplado
      const compressedModelUrl = await this.modelCompressor.compress(rawModelPath);

      // --- FASE 4: COMPLETADO ---
      job.status = 'COMPLETED';
      job.progressPercentage = 100;
      job.modelUrl = compressedModelUrl;
      job.updatedAt = new Date();
      await this.jobRepository.save(job);
      console.log(`[ProcessReconstructionJob] [${jobId}] ¡Procesamiento completado con éxito! (100%)`);
      console.log(`[ProcessReconstructionJob] [${jobId}] URL del modelo final: ${compressedModelUrl}`);

    } catch (error) {
      console.error(`[ProcessReconstructionJob] [${jobId}] [FALLO] Error en el pipeline:`, error);
      
      // Registrar el error en el repositorio para que el cliente conozca la causa
      job.status = 'FAILED';
      job.progressPercentage = 100;
      job.error = (error as Error).message || 'Error desconocido durante la reconstrucción';
      job.updatedAt = new Date();
      await this.jobRepository.save(job);
    }
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
