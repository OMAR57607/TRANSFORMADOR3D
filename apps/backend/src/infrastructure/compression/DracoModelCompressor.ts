import { IModelCompressor } from '../../domain/interfaces/IModelCompressor';
import { exec } from 'child_process';
import * as path from 'path';
import * as fs from 'fs';

/**
 * Implementación de infraestructura de IModelCompressor.
 * 
 * COMPRESIÓN DRACO:
 * Ejecuta el comando "gltf-pipeline" para comprimir la malla poligonal.
 * Si la herramienta no está disponible, realiza una copia directa sin compresión
 * para mantener la continuidad del sistema.
 */
export class DracoModelCompressor implements IModelCompressor {
  async compress(rawModelPath: string): Promise<string> {
    console.log(`[DracoModelCompressor] -> Iniciando etapa de compresión para: ${rawModelPath}`);

    const rawPath = path.resolve(rawModelPath);
    const dir = path.dirname(rawPath);
    const fileId = rawPath.split('-').pop()?.replace('.glb', '') || `${Date.now()}`;
    const compressedPath = path.join(dir, `vehicle-${fileId}-draco.glb`);

    // Intentar ejecutar gltf-pipeline de forma asíncrona
    return new Promise<string>((resolve) => {
      exec(`gltf-pipeline -i "${rawPath}" -o "${compressedPath}" -d`, (error, stdout, stderr) => {
        if (error) {
          console.warn('[DracoModelCompressor] Advertencia: gltf-pipeline no está disponible. Copiando modelo sin compresión.');
          try {
            fs.copyFileSync(rawPath, compressedPath);
          } catch (e) {
            console.error('[DracoModelCompressor] Error al copiar archivo de respaldo:', e);
          }
        } else {
          console.log('[DracoModelCompressor] Compresión Draco finalizada con éxito.');
        }

        // Retornar la URL absoluta local del servidor HTTP
        const finalUrl = `http://localhost:3000/models/vehicle-${fileId}-draco.glb`;
        resolve(finalUrl);
      });
    });
  }
}
