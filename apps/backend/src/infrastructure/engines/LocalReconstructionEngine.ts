import { IReconstructionEngine } from '../../domain/interfaces/IReconstructionEngine';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Implementación de infraestructura del IReconstructionEngine.
 * 
 * EJECUTA EL PIPELINE LOCAL REAL:
 * 1. Descomprime las fotos JPG del zip utilizando el comando nativo "tar" de Windows.
 * 2. Invoca el script de automatización en Python "reconstruct.py" que lanza COLMAP.
 * 3. Retorna la ruta física del archivo GLB reconstruido.
 */
export class LocalReconstructionEngine implements IReconstructionEngine {
  async runReconstruction(rawCaptureUrl: string, jobId: string): Promise<string> {
    const zipPath = path.resolve(rawCaptureUrl);
    const tempDir = path.dirname(zipPath);
    const extractDir = path.join(tempDir, `extracted-${jobId}`);
    const outputDir = path.join(tempDir, `output-${jobId}`);
    const logPath = path.join(tempDir, `job-${jobId}.log`);

    const log = (msg: string) => {
      const timestamp = new Date().toLocaleTimeString();
      fs.appendFileSync(logPath, `[${timestamp}] ${msg}\n`);
      console.log(`[LocalReconstructionEngine] [${jobId}] ${msg}`);
    };

    log("Iniciando ejecución del pipeline real.");

    // 1. Crear directorios de trabajo locales
    if (!fs.existsSync(extractDir)) {
      fs.mkdirSync(extractDir, { recursive: true });
    }
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // 2. Extraer archivo ZIP con el comando "tar" nativo de Windows (disponible en Win 10/11)
    log(`Descomprimiendo fotos JPG en: ${extractDir}`);
    await new Promise<void>((resolve) => {
      exec(`tar -xf "${zipPath}" -C "${extractDir}"`, (error, stdout, stderr) => {
        if (error) {
          log(`[ADVERTENCIA] Fallo al descomprimir con tar: ${stderr || error.message}`);
        } else {
          log("Extracción de archivos JPG completada con éxito.");
        }
        resolve();
      });
    });

    // 3. Ejecutar reconstruct.py pasando la carpeta de fotos y la carpeta de salida
    const scriptPath = path.join(__dirname, '../../scripts/reconstruct.py');
    const pythonCmd = `python "${scriptPath}" "${extractDir}" "${outputDir}" "${jobId}"`;

    log(`Lanzando proceso de reconstrucción Python...`);
    
    return new Promise<string>((resolve, reject) => {
      const child = exec(pythonCmd);

      child.stdout?.on('data', (data) => {
        fs.appendFileSync(logPath, data);
      });

      child.stderr?.on('data', (data) => {
        fs.appendFileSync(logPath, `[PYTHON ERR] ${data}`);
      });

      child.on('close', (code) => {
        if (code !== 0) {
          const errMsg = `El script de reconstrucción de Python falló con código de salida: ${code}`;
          log(`[ERROR] ${errMsg}`);
          reject(new Error(errMsg));
          return;
        }

        const glbPath = path.join(outputDir, `tacoma-${jobId}.glb`);
        if (fs.existsSync(glbPath)) {
          log("Modelo GLB generado con éxito por el pipeline.");
          resolve(glbPath);
        } else {
          const errMsg = `El proceso terminó sin errores pero no se encontró el archivo GLB en la ruta esperada: ${glbPath}`;
          log(`[ERROR] ${errMsg}`);
          reject(new Error(errMsg));
        }
      });
    });
  }
}
