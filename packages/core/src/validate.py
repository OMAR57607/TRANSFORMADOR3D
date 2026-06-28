import abc
import time
import uuid
from typing import Callable, Optional, TypedDict

# --- CAPA DE DOMINIO (INTERFACES / CONTRATOS) ---

class ScanJob(TypedDict):
    jobId: str
    status: str
    progressPercentage: int
    modelUrl: Optional[str]
    error: Optional[str]

class IScanningProcessor(abc.ABC):
    """
    Contrato de Dominio para el procesamiento 3D.
    Aplica DIP y OCP: desacopla el núcleo de cualquier backend específico.
    """
    @abc.abstractmethod
    def start_scan(self, source_url: str) -> ScanJob:
        pass

    @abc.abstractmethod
    def get_scan_status(self, job_id: str) -> ScanJob:
        pass

class IFileUploader(abc.ABC):
    """
    Contrato de Dominio para la subida resiliente de archivos.
    Aplica SRP: aísla el transporte físico.
    """
    @abc.abstractmethod
    def upload_file(self, local_file_path: str, on_progress: Optional[Callable[[int], None]] = None, max_retries: int = 3, initial_delay: float = 1.0) -> str:
        pass


# --- CAPA DE APLICACIÓN (CASOS DE USO) ---

class SubmitVehicleScan:
    """
    Caso de Uso: SubmitVehicleScan.
    Coordina el flujo de negocio dependiendo únicamente de las abstracciones (DIP).
    """
    def __init__(self, file_uploader: IFileUploader, scanning_processor: IScanningProcessor):
        self.file_uploader = file_uploader
        self.scanning_processor = scanning_processor

    def execute(self, local_file_path: str, vehicle_id: str, on_progress: Optional[Callable[[str, int], None]] = None) -> ScanJob:
        # Validación de reglas de negocio
        if not local_file_path:
            raise ValueError('La ruta del archivo local no puede estar vacía.')
        if not vehicle_id:
            raise ValueError('El ID del vehículo es obligatorio.')

        # Validar extensiones
        if not (local_file_path.endswith('.mp4') or local_file_path.endswith('.mov') or local_file_path.endswith('.zip')):
            raise ValueError('El archivo debe tener un formato válido: .mp4, .mov o .zip.')

        # Callback intermedio para mapear progreso
        def upload_progress_callback(percent: int):
            if on_progress:
                on_progress('UPLOADING', percent)

        # Subir archivo con configuración de reintentos
        remote_url = self.file_uploader.upload_file(
            local_file_path,
            on_progress=upload_progress_callback,
            max_retries=3,
            initial_delay=0.5
        )

        if on_progress:
            on_progress('SCANNING_QUEUED', 0)

        # Iniciar reconstrucción 3D
        scan_job = self.scanning_processor.start_scan(remote_url)
        return scan_job


# --- CAPA DE INFRAESTRUCTURA (IMPLEMENTACIONES MOCK) ---

class MockFileUploader(IFileUploader):
    """
    Implementación Mock de IFileUploader.
    Demuestra resiliencia y reintentos con backoff exponencial.
    """
    def __init__(self):
        self.attempts = 0

    def upload_file(self, local_file_path: str, on_progress: Optional[Callable[[int], None]] = None, max_retries: int = 3, initial_delay: float = 0.5) -> str:
        self.attempts = 0
        
        def execute_upload(attempt: int) -> str:
            self.attempts += 1
            print(f"[MockFileUploader] Intentando subir archivo (Intento {attempt}/{max_retries + 1})...")
            
            # Simulamos fallo de red temporal en el primer intento
            if attempt == 1:
                print("[MockFileUploader] [FALLO SIMULADO] Error de conexión de red 5G.")
                raise ConnectionError("Timeout de conexión / Pérdida de paquetes")

            # Simulamos subida exitosa progresiva
            for i in range(1, 6):
                percent = int((i / 5) * 100)
                time.sleep(0.15)
                if on_progress:
                    on_progress(percent)

            filename = local_file_path.split('/')[-1]
            remote_url = f"https://storage.3dvehiclescanner.internal/raw-captures/{int(time.time())}-{filename}"
            print(f"[MockFileUploader] Subida exitosa. URL: {remote_url}")
            return remote_url

        # Bucle de reintentos con backoff exponencial
        for attempt in range(1, max_retries + 2):
            try:
                return execute_upload(attempt)
            except Exception as e:
                if attempt > max_retries:
                    print("[MockFileUploader] Se superó el límite de reintentos. Fallo definitivo.")
                    raise e
                
                # Backoff exponencial: delay * 2^(attempt - 1)
                delay = initial_delay * (2 ** (attempt - 1))
                print(f"[MockFileUploader] Reintentando en {delay}s... (Backoff Exponencial)")
                time.sleep(delay)
        
        raise RuntimeError("Fallo inesperado de subida.")


class MockScanningProcessor(IScanningProcessor):
    """
    Implementación Mock de IScanningProcessor.
    Simula el pipeline asíncrono incrementando el progreso en cada consulta de estado.
    """
    def __init__(self):
        self.jobs = {}

    def start_scan(self, source_url: str) -> ScanJob:
        print(f"[MockScanningProcessor] Iniciando reconstrucción 3D para: {source_url}")
        job_id = f"scan-job-{uuid.uuid4().hex[:9]}"
        job: ScanJob = {
            "jobId": job_id,
            "status": "PROCESSING",
            "progressPercentage": 15,
            "modelUrl": None,
            "error": None
        }
        self.jobs[job_id] = job
        print(f"[MockScanningProcessor] [{job_id}] El estado cambió a PROCESSING.")
        return job

    def get_scan_status(self, job_id: str) -> ScanJob:
        job = self.jobs.get(job_id)
        if not job:
            raise KeyError(f"Trabajo {job_id} no encontrado.")
        
        if job["status"] in ("COMPLETED", "FAILED"):
            return job

        # Incrementar el progreso simulado
        job["progressPercentage"] += 25
        if job["progressPercentage"] >= 100:
            job["progressPercentage"] = 100
            job["status"] = "COMPLETED"
            # URL simulando Draco compression
            job["modelUrl"] = f"https://storage.3dvehiclescanner.internal/models/{job_id}_draco_optimized.glb"
            print(f"[MockScanningProcessor] [{job_id}] Reconstrucción finalizada con éxito.")
        else:
            print(f"[MockScanningProcessor] [{job_id}] Progreso: {job['progressPercentage']}%")

        self.jobs[job_id] = job
        return job


# --- PUNTO DE ENTRADA Y VALIDACIÓN ---

def main():
    print("===========================================================")
    print("   INICIANDO SIMULACIÓN EN PYTHON (VALIDACIÓN ARQUITECTURA)")
    print("===========================================================\n")

    # Inyección de Dependencias
    uploader = MockFileUploader()
    processor = MockScanningProcessor()
    use_case = SubmitVehicleScan(uploader, processor)

    try:
        local_file = "videos/captura_mustang_2025.mp4"
        vehicle_id = "ford-mustang-gt-2025"

        print(f"[Cliente] Iniciando escaneo para {vehicle_id}...")
        
        def progress_callback(step: str, progress: int):
            print(f"[NOTIFICACIÓN PROGRESO] Paso: {step} | Avance: {progress}%")

        initial_job = use_case.execute(local_file, vehicle_id, on_progress=progress_callback)

        print(f"\n[Cliente] Trabajo iniciado. ID: {initial_job['jobId']} | Estado: {initial_job['status']}")
        print("-----------------------------------------------------------\n")

        print("[Cliente] Iniciando polling del progreso...")
        job_id = initial_job['jobId']
        
        # Consultar hasta que esté completo
        while True:
            time.sleep(0.8)
            status = processor.get_scan_status(job_id)
            if status["status"] == "COMPLETED":
                print('\n===========================================================')
                print('   PROCESO COMPLETADO EXCELENTEMENTE')
                print('===========================================================')
                print(f"ID del Escaneo: {status['jobId']}")
                print(f"URL del Modelo GLB Optimizado (Draco):")
                print(f"-> {status['modelUrl']}")
                print('===========================================================\n')
                break
            elif status["status"] == "FAILED":
                print(f"\n[Cliente] Error en el escaneo: {status['error']}")
                break

    except Exception as e:
        print(f"\n[Cliente] [ERROR] Falló el flujo: {e}")

if __name__ == '__main__':
    main()
