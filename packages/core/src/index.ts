import { SubmitVehicleScan } from './application/use-cases/SubmitVehicleScan';
import { MockFileUploader } from './infrastructure/mocks/MockFileUploader';
import { MockScanningProcessor } from './infrastructure/mocks/MockScanningProcessor';

/**
 * Script de validación para la ejecución del caso de uso.
 * 
 * APLICA LA INVERSIÓN DE DEPENDENCIAS (DIP):
 * Instanciamos las clases de infraestructura (MockFileUploader, MockScanningProcessor)
 * e inyectamos estas implementaciones de bajo nivel en nuestro caso de uso de alto nivel,
 * que depende únicamente de las interfaces IFileUploader e IScanningProcessor.
 */
async function runValidation() {
  console.log('===========================================================');
  console.log('   INICIANDO SIMULACIÓN - PIPELINE DE ESCANEO VEHÍCULO 3D');
  console.log('===========================================================\n');

  // 1. Instanciar implementaciones concretas (Infraestructura)
  const fileUploader = new MockFileUploader();
  const scanningProcessor = new MockScanningProcessor();

  // 2. Inyectar dependencias en el Caso de Uso (Aplicación)
  const submitVehicleScan = new SubmitVehicleScan(fileUploader, scanningProcessor);

  try {
    const localFilePath = 'videos/captura_mustang_2025.mp4';
    const vehicleId = 'ford-mustang-gt-2025';

    console.log(`[Cliente] Solicitando escaneo de vehículo...`);
    console.log(`[Cliente] ID Vehículo: ${vehicleId}`);
    console.log(`[Cliente] Ruta Captura: ${localFilePath}\n`);

    // 3. Ejecutar el caso de uso
    const initialJob = await submitVehicleScan.execute({
      localFilePath,
      vehicleId,
      onProgress: (step, progress) => {
        console.log(`[NOTIFICACIÓN PROGRESO] Paso: ${step} | Avance: ${progress}%`);
      }
    });

    console.log(`\n[Cliente] Transacción inicial completada.`);
    console.log(`[Cliente] ID del Trabajo de Escaneo: ${initialJob.jobId}`);
    console.log(`[Cliente] Estado Inicial: ${initialJob.status}`);
    console.log(`-----------------------------------------------------------\n`);

    // 4. Simulación del cliente o visor consultando periódicamente el progreso (Polling)
    console.log('[Cliente] Comenzando consulta periódica (polling) de estado de reconstrucción...');
    
    const intervalId = setInterval(async () => {
      try {
        const currentJob = await scanningProcessor.getScanStatus(initialJob.jobId);
        
        if (currentJob.status === 'COMPLETED') {
          clearInterval(intervalId);
          console.log('\n===========================================================');
          console.log('   PROCESO COMPLETADO EXCELENTEMENTE');
          console.log('===========================================================');
          console.log(`ID del Escaneo: ${currentJob.jobId}`);
          console.log(`URL del Modelo GLB Optimizado (Draco):`);
          console.log(`👉 ${currentJob.modelUrl}`);
          console.log('===========================================================\n');
        } else if (currentJob.status === 'FAILED') {
          clearInterval(intervalId);
          console.error(`\n[Cliente] [ERROR] Falló la reconstrucción 3D: ${currentJob.error}`);
        }
      } catch (err) {
        clearInterval(intervalId);
        console.error(`[Cliente] [ERROR] Falló el polling: ${(err as Error).message}`);
      }
    }, 800); // Polling rápido para demostración dinámica

  } catch (error) {
    console.error(`\n[Cliente] [ERROR GENERAL] Ocurrió un fallo en el flujo: ${(error as Error).message}`);
  }
}

runValidation();
