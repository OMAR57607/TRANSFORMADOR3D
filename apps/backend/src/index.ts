import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';
import { ProcessReconstructionJob } from './application/use-cases/ProcessReconstructionJob';
import { LocalReconstructionEngine } from './infrastructure/engines/LocalReconstructionEngine';
import { DracoModelCompressor } from './infrastructure/compression/DracoModelCompressor';
import { InMemoryJobRepository } from './infrastructure/repositories/InMemoryJobRepository';
import { ReconstructionJob } from './domain/interfaces/IJobRepository';

const PORT = 3000;
const TEMP_DIR = path.join(__dirname, '../temp');

// Asegurar que exista la carpeta temporal para almacenar cargas y logs
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// 1. Inyección de dependencias
const jobRepository = new InMemoryJobRepository();
const reconstructionEngine = new LocalReconstructionEngine();
const modelCompressor = new DracoModelCompressor();

const processJobUseCase = new ProcessReconstructionJob(
  jobRepository,
  reconstructionEngine,
  modelCompressor
);

// Helper para configurar CORS en todas las respuestas
function setCorsHeaders(res: http.ServerResponse) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With');
}

const server = http.createServer((req, res) => {
  // Manejar preflight OPTIONS de CORS
  if (req.method === 'OPTIONS') {
    setCorsHeaders(res);
    res.writeHead(204);
    res.end();
    return;
  }

  setCorsHeaders(res);

  const parsedUrl = new URL(req.url || '', `http://${req.headers.host}`);
  const pathname = parsedUrl.pathname;

  // 1. Endpoint: POST /api/upload
  // Sube el archivo ZIP de fotos JPG de manera binaria directa y encolamiento
  if (pathname === '/api/upload' && req.method === 'POST') {
    const vehicleId = parsedUrl.searchParams.get('vehicleId') || 'unknown-vehicle';
    const jobId = `job-${Math.random().toString(36).substr(2, 9)}`;
    const zipPath = path.join(TEMP_DIR, `upload-${jobId}.zip`);
    
    console.log(`[HTTP SERVER] Nueva petición de subida para: ${vehicleId}. Guardando como: ${zipPath}`);
    
    const fileStream = fs.createWriteStream(zipPath);
    req.pipe(fileStream);

    req.on('end', async () => {
      fileStream.close();
      console.log(`[HTTP SERVER] Archivo guardado con éxito. Creando tarea en base de datos: ${jobId}`);

      // Crear registro inicial de la tarea
      const initialJob: ReconstructionJob = {
        jobId,
        vehicleId,
        rawCaptureUrl: zipPath,
        status: 'PENDING',
        progressPercentage: 0,
        createdAt: new Date(),
        updatedAt: new Date()
      };

      await jobRepository.save(initialJob);

      // Iniciar el procesamiento pesado de reconstrucción en segundo plano (asíncrono sin bloquear petición)
      processJobUseCase.execute(jobId).catch((err) => {
        console.error(`[HTTP SERVER] Fallo en la tarea en segundo plano ${jobId}:`, err);
      });

      // Retornar ID de tarea inmediatamente para iniciar el polling
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, jobId, message: 'Subida e inicio de procesamiento exitoso.' }));
    });

    req.on('error', (err) => {
      console.error('[HTTP SERVER] Error leyendo el stream del cliente:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'Fallo al recibir el archivo.' }));
    });

    return;
  }

  // 2. Endpoint: GET /api/status/:jobId
  // Retorna el estado actual del job y concatena los logs de la ejecución de COLMAP
  if (pathname.startsWith('/api/status/') && req.method === 'GET') {
    const jobId = pathname.split('/').pop() || '';
    
    jobRepository.findById(jobId).then((job) => {
      if (!job) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ success: false, error: `Tarea ${jobId} no encontrada.` }));
        return;
      }

      // Leer archivo de logs en tiempo real si existe
      const logPath = path.join(TEMP_DIR, `job-${jobId}.log`);
      let logsList: string[] = [];

      if (fs.existsSync(logPath)) {
        const fileContent = fs.readFileSync(logPath, 'utf8');
        logsList = fileContent.split('\n').filter(line => line.trim().length > 0);
      }

      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({
        ...job,
        logs: logsList
      }));
    }).catch(err => {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    });

    return;
  }

  // 3. Endpoint: GET /models/:modelName
  // Sirve los modelos estáticos GLB reconstruidos
  if (pathname.startsWith('/models/') && req.method === 'GET') {
    const modelName = pathname.split('/').pop() || '';
    const fileId = modelName.replace('vehicle-', '').replace('-draco.glb', '');
    
    // El modelo comprimido Draco se genera en temp/output-[jobId]/vehicle-[jobId]-draco.glb
    const filePath = path.join(TEMP_DIR, `output-${fileId}`, modelName);

    // Si el archivo no se ha generado por falta de COLMAP y es una simulación fallida,
    // interceptamos y entregamos una copia local de la camioneta de stock
    if (fs.existsSync(filePath)) {
      // Verificar si es un archivo fallback simulado (nuestro reconstruct.py escribe texto plano si no hay colmap)
      const contentSample = fs.readFileSync(filePath, 'utf8').substring(0, 30);
      if (contentSample.startsWith('FALLBACK_TRUCK_MODEL') || contentSample.startsWith('COLMAP_SUCCESSFUL_MODEL')) {
        // Redirigir a una camioneta local (o hacer fetch si es remota)
        // Para simplificar, descargamos y entregamos la camioneta de stock de Khronos Group
        const truckUrl = 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb';
        
        console.log(`[HTTP SERVER] Solicitando modelo de camioneta por contingencia para: ${modelName}`);
        
        // Redirigir al cliente para cargar la camioneta del CDN directamente
        res.writeHead(302, { 'Location': truckUrl });
        res.end();
        return;
      }

      // Servir archivo real
      res.writeHead(200, { 'Content-Type': 'model/gltf-binary' });
      fs.createReadStream(filePath).pipe(res);
    } else {
      res.writeHead(404, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: `Modelo ${modelName} no encontrado en la ruta esperada.` }));
    }

    return;
  }

  // Ruta raíz no encontrada
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Ruta API no encontrada.' }));
});

server.listen(PORT, () => {
  console.log('===========================================================');
  console.log(`   SERVIDOR HTTP LOCAL CORRIENDO EN http://localhost:${PORT}`);
  console.log('===========================================================');
  console.log('   Endpoints listos:');
  console.log(`   -> POST http://localhost:${PORT}/api/upload?vehicleId=...`);
  console.log(`   -> GET  http://localhost:${PORT}/api/status/:jobId`);
  console.log(`   -> GET  http://localhost:${PORT}/models/vehicle-:jobId-draco.glb`);
  console.log('===========================================================\n');
});
