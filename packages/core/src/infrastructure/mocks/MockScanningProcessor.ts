import { IScanningProcessor, ScanJob } from '../../domain/interfaces/IScanningProcessor';

/**
 * Implementación Mock de IScanningProcessor.
 * 
 * APLICA LOS PRINCIPIOS DE CLEAN ARCHITECTURE:
 * Ubicado en la capa de Infraestructura. Es un detalle técnico intercambiable.
 * Implementa el contrato del dominio para poder ser inyectado en los casos de uso.
 * 
 * SIMULACIÓN DE PIPELINE 3D:
 * Simula el comportamiento asíncrono del pipeline de Gaussian Splatting / Fotogrametría.
 * En cada llamada a `getScanStatus` (simulando consultas periódicas o polling), incrementa
 * el progreso hasta finalizar y retornar la URL de un modelo 3D GLB comprimido.
 */
export class MockScanningProcessor implements IScanningProcessor {
  private jobs = new Map<string, ScanJob>();

  /**
   * Registra e inicia un nuevo trabajo de escaneo simulado.
   */
  async startScan(sourceUrl: string): Promise<ScanJob> {
    console.log(`[MockScanningProcessor] Iniciando reconstrucción 3D a partir del recurso: ${sourceUrl}`);
    
    const jobId = `scan-job-${Math.random().toString(36).substr(2, 9)}`;
    const initialJob: ScanJob = {
      jobId,
      status: 'PENDING',
      progressPercentage: 0
    };

    this.jobs.set(jobId, initialJob);

    // Simulación de paso rápido a estado PROCESSING en segundo plano
    setTimeout(() => {
      const job = this.jobs.get(jobId);
      if (job) {
        job.status = 'PROCESSING';
        job.progressPercentage = 15;
        this.jobs.set(jobId, job);
        console.log(`[MockScanningProcessor] [${jobId}] El estado cambió a PROCESSING.`);
      }
    }, 100);

    return initialJob;
  }

  /**
   * Consulta el progreso simulado e incrementa el avance con cada petición.
   */
  async getScanStatus(jobId: string): Promise<ScanJob> {
    const job = this.jobs.get(jobId);
    if (!job) {
      throw new Error(`El trabajo de escaneo con ID "${jobId}" no existe.`);
    }

    if (job.status === 'COMPLETED' || job.status === 'FAILED') {
      return job;
    }

    // Simular el incremento del progreso de reconstrucción (Gaussian Splatting / Draco Compression)
    if (job.status === 'PROCESSING') {
      job.progressPercentage += 25; // Incrementar un 25% por llamada
      
      if (job.progressPercentage >= 100) {
        job.progressPercentage = 100;
        job.status = 'COMPLETED';
        // Simulamos la entrega de un modelo optimizado comprimido con Draco
        job.modelUrl = `https://storage.3dvehiclescanner.internal/models/${jobId}_draco_optimized.glb`;
        console.log(`[MockScanningProcessor] [${jobId}] Reconstrucción finalizada con éxito.`);
      } else {
        console.log(`[MockScanningProcessor] [${jobId}] Progreso de reconstrucción: ${job.progressPercentage}%`);
      }
    } else if (job.status === 'PENDING') {
      job.status = 'PROCESSING';
      job.progressPercentage = 10;
      console.log(`[MockScanningProcessor] [${jobId}] Transición de PENDING a PROCESSING.`);
    }

    this.jobs.set(jobId, job);
    return job;
  }
}
