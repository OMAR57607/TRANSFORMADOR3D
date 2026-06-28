import { IFileUploader } from '../../domain/interfaces/IFileUploader';
import { IScanningProcessor, ScanJob } from '../../domain/interfaces/IScanningProcessor';

/**
 * Parámetros de entrada para el caso de uso.
 */
export interface SubmitVehicleScanInput {
  localFilePath: string;
  vehicleId: string;
  onProgress?: (step: 'UPLOADING' | 'SCANNING_QUEUED', progress: number) => void;
}

/**
 * Caso de Uso: Enviar Escaneo de Vehículo (SubmitVehicleScan)
 * 
 * APLICA PRINCIPIOS DE CLEAN ARCHITECTURE:
 * Pertenece a la capa de Aplicación. No tiene dependencias de detalles técnicos,
 * bases de datos ni servicios de red específicos. Toda la comunicación con el exterior
 * se realiza mediante la Inversión de Dependencias (DIP) inyectando interfaces de Dominio.
 * 
 * APLICA EL PRINCIPIO DE RESPONSABILIDAD ÚNICA (SRP):
 * Coordina exclusivamente el flujo del proceso de escaneo: validar entrada, subir
 * archivo e iniciar el escaneo 3D.
 */
export class SubmitVehicleScan {
  constructor(
    private readonly fileUploader: IFileUploader,
    private readonly scanningProcessor: IScanningProcessor
  ) {}

  /**
   * Ejecuta el flujo para enviar y registrar un nuevo escaneo 3D.
   * @param input Parámetros que incluyen la ruta del archivo local y el ID del vehículo.
   * @returns Un objeto ScanJob que representa el trabajo de reconstrucción 3D iniciado.
   */
  async execute(input: SubmitVehicleScanInput): Promise<ScanJob> {
    // 1. Validación de reglas de negocio
    if (!input.localFilePath) {
      throw new Error('La ruta del archivo local no puede estar vacía.');
    }
    if (!input.vehicleId) {
      throw new Error('El ID del vehículo es obligatorio para asociar el modelo.');
    }

    // Validar extensiones soportadas (.mp4, .mov para videos o .zip para fotos ordenadas)
    const validExtensions = /\.(mp4|mov|zip)$/i;
    if (!validExtensions.test(input.localFilePath)) {
      throw new Error('El archivo debe tener un formato válido: .mp4, .mov o un paquete comprimido .zip.');
    }

    // 2. Subida resiliente del archivo (usando la interfaz inyectada)
    const remoteUrl = await this.fileUploader.uploadFile(input.localFilePath, {
      onProgress: (percent) => {
        if (input.onProgress) {
          input.onProgress('UPLOADING', percent);
        }
      },
      maxRetries: 3,
      initialDelayMs: 500 // Tiempo base corto para la simulación
    });

    // 3. Inicio del proceso de reconstrucción en el backend o pipeline 3D
    if (input.onProgress) {
      input.onProgress('SCANNING_QUEUED', 0);
    }
    const scanJob = await this.scanningProcessor.startScan(remoteUrl);

    return scanJob;
  }
}
