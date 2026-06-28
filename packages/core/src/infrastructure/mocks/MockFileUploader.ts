import { IFileUploader, UploadOptions } from '../../domain/interfaces/IFileUploader';

/**
 * Helper para pausar la ejecución de forma asíncrona.
 */
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Implementación Mock de IFileUploader.
 * 
 * APLICA RESILIENCIA Y MECANISMO DE REINTENTOS CON BACKOFF EXPONENCIAL:
 * Simula una red móvil inestable fallando intencionalmente en el primer intento.
 * Luego, ejecuta un bucle de reintentos calculando un tiempo de espera exponencial:
 * tiempo = delayBase * 2^(intento - 1).
 * Reporta el progreso de subida de 0 a 100% de manera progresiva.
 */
export class MockFileUploader implements IFileUploader {
  private totalUploadAttempts = 0;

  async uploadFile(localFilePath: string, options?: UploadOptions): Promise<string> {
    const maxRetries = options?.maxRetries ?? 3;
    const initialDelayMs = options?.initialDelayMs ?? 1000;
    const onProgress = options?.onProgress;

    // Reiniciar intentos por archivo
    this.totalUploadAttempts = 0;

    const executeWithRetry = async (attempt: number): Promise<string> => {
      this.totalUploadAttempts++;
      console.log(`[MockFileUploader] Intentando subir archivo (Intento ${attempt}/${maxRetries + 1})...`);

      // 1. Simulación de fallo de red temporal en el primer intento para validar la resiliencia
      if (attempt === 1) {
        console.warn(`[MockFileUploader] [FALLO SIMULADO] Error de conexión de red 4G/5G inestable.`);
        throw new Error('Timeout / Connection Loss');
      }

      // 2. Simulación de subida exitosa progresiva (incrementando de 20% en 20%)
      const steps = 5;
      for (let i = 1; i <= steps; i++) {
        const percent = (i / steps) * 100;
        await sleep(150); // Simula el tiempo de transmisión del fragmento
        if (onProgress) {
          onProgress(percent);
        }
      }

      // Retornar una URL de recurso simulado
      const filename = localFilePath.split('/').pop() || 'captura.mp4';
      const remoteUrl = `https://storage.3dvehiclescanner.internal/raw-captures/${Date.now()}-${filename}`;
      console.log(`[MockFileUploader] Subida exitosa. URL del recurso: ${remoteUrl}`);
      return remoteUrl;
    };

    // Bucle de control de reintentos
    for (let attempt = 1; attempt <= maxRetries + 1; attempt++) {
      try {
        return await executeWithRetry(attempt);
      } catch (error) {
        if (attempt > maxRetries) {
          console.error(`[MockFileUploader] Subida fallida después de ${maxRetries} reintentos.`);
          throw new Error(`Error de subida persistente: ${(error as Error).message}`);
        }

        // Cálculo de Backoff Exponencial
        const delay = initialDelayMs * Math.pow(2, attempt - 1);
        console.log(`[MockFileUploader] Reintentando en ${delay}ms... (Backoff Exponencial)`);
        await sleep(delay);
      }
    }

    throw new Error('Error inesperado durante el flujo de subida.');
  }
}
