import { IJobRepository, ReconstructionJob } from '../../domain/interfaces/IJobRepository';

/**
 * Implementación de infraestructura en memoria para IJobRepository.
 * 
 * PERSISTENCIA EN MEMORIA:
 * Simula el acceso y guardado en base de datos.
 * Clona los objetos al guardar y recuperar para simular el comportamiento de una
 * base de datos real (donde los objetos no comparten referencias en memoria).
 */
export class InMemoryJobRepository implements IJobRepository {
  private database = new Map<string, ReconstructionJob>();

  async save(job: ReconstructionJob): Promise<void> {
    // Clonar para simular serialización en DB
    this.database.set(job.jobId, JSON.parse(JSON.stringify(job)));
  }

  async findById(jobId: string): Promise<ReconstructionJob | null> {
    const job = this.database.get(jobId);
    if (!job) {
      return null;
    }
    // Retornar una copia
    return JSON.parse(JSON.stringify(job));
  }
}
