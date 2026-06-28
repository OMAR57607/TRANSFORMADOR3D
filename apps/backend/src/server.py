import os
import sys
import json
import uuid
import ssl
import time
import shutil
import base64
import threading
import urllib.request
import urllib.error
import zipfile
from urllib.parse import urlparse, parse_qs
from http.server import HTTPServer, BaseHTTPRequestHandler

PORT = 3000
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
TEMP_DIR = os.path.abspath(os.path.join(BASE_DIR, "..", "temp"))

# Configurar contexto de SSL para ignorar errores de certificados locales/corporativos
ssl_context = ssl.create_default_context()
ssl_context.check_hostname = False
ssl_context.verify_mode = ssl.CERT_NONE

# Asegurar que el directorio temporal exista
os.makedirs(TEMP_DIR, exist_ok=True)

class BackendAPIHandler(BaseHTTPRequestHandler):
    def end_headers(self):
        # Cabeceras CORS globales
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, X-Requested-With')
        super().end_headers()

    def do_OPTIONS(self):
        # Responder preflight de CORS
        self.send_response(204)
        self.end_headers()

    def do_GET(self):
        parsed_url = urlparse(self.path)
        path_parts = parsed_url.path.strip("/").split("/")

        # 1. Endpoint: GET /api/jobs
        if len(path_parts) >= 2 and path_parts[0] == "api" and path_parts[1] == "jobs":
            jobs_with_time = []
            if os.path.exists(TEMP_DIR):
                for file in os.listdir(TEMP_DIR):
                    if file.startswith("job-") and file.endswith(".json"):
                        try:
                            filepath = os.path.join(TEMP_DIR, file)
                            mtime = os.path.getmtime(filepath)
                            with open(filepath, 'r', encoding='utf-8') as f:
                                jobs_with_time.append((mtime, json.load(f)))
                        except Exception:
                            pass
            # Ordenar por tiempo de modificación descendente (más nuevo arriba)
            jobs_with_time.sort(key=lambda x: x[0], reverse=True)
            jobs = [j[1] for j in jobs_with_time]
            
            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps({"success": True, "jobs": jobs}).encode('utf-8'))
            return

        # 2. Endpoint: GET /api/status/<jobId>
        if len(path_parts) >= 3 and path_parts[0] == "api" and path_parts[1] == "status":
            job_id = path_parts[2]
            job_file = os.path.join(TEMP_DIR, f"job-{job_id}.json")
            log_file = os.path.join(TEMP_DIR, f"job-{job_id}.log")

            if not os.path.exists(job_file):
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": f"Tarea {job_id} no encontrada."}).encode('utf-8'))
                return

            # Leer estado
            with open(job_file, 'r', encoding='utf-8') as f:
                job_data = json.load(f)

            # Leer logs en tiempo real
            logs = []
            if os.path.exists(log_file):
                with open(log_file, 'r', encoding='utf-8', errors='replace') as f:
                    logs = [line.strip() for line in f if line.strip()]

            job_data["logs"] = logs

            self.send_response(200)
            self.send_header('Content-Type', 'application/json')
            self.end_headers()
            self.wfile.write(json.dumps(job_data).encode('utf-8'))
            return

        # 2. Endpoint: GET /models/<modelName>
        # Sirve el modelo descargado de Replicate (soporta .obj y .glb/.gltf)
        if len(path_parts) >= 2 and path_parts[0] == "models":
            model_name = path_parts[1]
            file_id = model_name.replace("vehicle-", "")
            for suffix in ["-draco.glb", ".glb", ".gltf", ".obj"]:
                file_id = file_id.replace(suffix, "")
            
            file_path = os.path.join(TEMP_DIR, f"output-{file_id}", model_name)

            if os.path.exists(file_path):
                content_type = 'model/gltf-binary'
                if model_name.lower().endswith('.obj'):
                    content_type = 'text/plain'
                elif model_name.lower().endswith('.gltf'):
                    content_type = 'model/gltf+json'

                self.send_response(200)
                self.send_header('Content-Type', content_type)
                self.end_headers()
                with open(file_path, 'rb') as f:
                    self.wfile.write(f.read())
            else:
                self.send_response(404)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": f"Modelo {model_name} no encontrado."}).encode('utf-8'))
            return

        # 3. Servir archivos estáticos del frontend (apps/web)
        web_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "web"))
        rel_path = parsed_url.path.lstrip("/")
        if not rel_path or rel_path == "":
            rel_path = "index.html"
            
        file_path = os.path.abspath(os.path.join(web_dir, rel_path))
        
        # Evitar directory traversal y comprobar que el archivo exista
        if file_path.startswith(web_dir) and os.path.exists(file_path) and os.path.isfile(file_path):
            mime_types = {
                ".html": "text/html",
                ".css": "text/css",
                ".js": "application/javascript",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
                ".json": "application/json",
                ".glb": "model/gltf-binary",
                ".gltf": "model/gltf+json",
                ".obj": "text/plain"
            }
            _, ext = os.path.splitext(file_path.lower())
            content_type = mime_types.get(ext, "application/octet-stream")
            
            self.send_response(200)
            self.send_header('Content-Type', content_type)
            self.end_headers()
            with open(file_path, 'rb') as f:
                self.wfile.write(f.read())
            return

        # Ruta no encontrada
        self.send_response(404)
        self.end_headers()

    def do_POST(self):
        parsed_url = urlparse(self.path)
        
        # 1. Endpoint: POST /api/upload
        if parsed_url.path == "/api/upload":
            query_params = parse_qs(parsed_url.query)
            vehicle_id = query_params.get("vehicleId", ["unknown-vehicle"])[0]
            
            # Obtener token de Replicate (del input en el navegador o variable del entorno)
            token = query_params.get("token", [""])[0].strip()
            if not token:
                token = os.environ.get("REPLICATE_API_TOKEN", "").strip()

            # Si el token sigue vacío, retornar error descriptivo al usuario de inmediato
            if not token:
                self.send_response(400)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": False, 
                    "error": "No has ingresado tu Token de API de Replicate. Por favor, introduce tu token r8_... en el campo de texto de la interfaz para activar la IA real."
                }).encode('utf-8'))
                return

            job_id = f"job-{uuid.uuid4().hex[:9]}"
            image_path = os.path.join(TEMP_DIR, f"upload-{job_id}.jpg")

            print(f"[HTTP SERVER] Recibiendo foto JPG para Replicate. Guardando en: {image_path}")

            content_length = int(self.headers.get('Content-Length', 0))
            
            try:
                # Escribir el stream binario de la imagen al disco
                with open(image_path, 'wb') as f:
                    remaining = content_length
                    buffer_size = 64 * 1024
                    while remaining > 0:
                        chunk = self.rfile.read(min(remaining, buffer_size))
                        if not chunk:
                            break
                        f.write(chunk)
                        remaining -= len(chunk)

                # Inicializar archivo JSON del trabajo
                job_data = {
                    "jobId": job_id,
                    "vehicleId": vehicle_id,
                    "rawCaptureUrl": image_path,
                    "status": "PENDING",
                    "progressPercentage": 0
                }
                
                job_file = os.path.join(TEMP_DIR, f"job-{job_id}.json")
                with open(job_file, 'w', encoding='utf-8') as f:
                    json.dump(job_data, f, indent=2)

                # Ejecutar el pipeline de Replicate en un hilo en segundo plano
                thread = threading.Thread(target=run_3d_prediction, args=(job_id, image_path, token))
                thread.start()

                # Retornar jobId para iniciar polling
                self.send_response(200)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({
                    "success": True, 
                    "jobId": job_id, 
                    "message": "Subida y procesamiento por IA encolado."
                }).encode('utf-8'))

            except Exception as e:
                print(f"[HTTP SERVER] Error guardando archivo: {str(e)}")
                self.send_response(500)
                self.send_header('Content-Type', 'application/json')
                self.end_headers()
                self.wfile.write(json.dumps({"success": False, "error": str(e)}).encode('utf-8'))
            return

        self.send_response(404)
        self.end_headers()

def update_job_status(job_id, status, progress, error_msg=None, model_url=None):
    job_file = os.path.join(TEMP_DIR, f"job-{job_id}.json")
    if os.path.exists(job_file):
        with open(job_file, 'r', encoding='utf-8') as f:
            data = json.load(f)
        
        data["status"] = status
        data["progressPercentage"] = progress
        if error_msg:
            data["error"] = error_msg
        if model_url:
            data["modelUrl"] = model_url
            
        with open(job_file, 'w', encoding='utf-8') as f:
            json.dump(data, f, indent=2)

def _add_bg_removal(payload_input, input_keys):
    """Activa la eliminación de fondo si el modelo de Replicate la soporta.
    Quitar el fondo mejora muchísimo la calidad de la reconstrucción 3D."""
    for key in ("remove_background", "do_remove_background", "remove_bg", "background_removal"):
        if key in input_keys:
            payload_input[key] = True
            break

def run_3d_prediction(job_id, image_path, token):
    """Pipeline principal de reconstrucción 3D. Soporta dos proveedores:
    - Meshy (token msy_...): Multi-imagen nativo, hasta 4 ángulos
    - Replicate (token r8_...): Descubrimiento dinámico de modelos
    """
    log_file = os.path.join(TEMP_DIR, f"job-{job_id}.log")
    output_dir = os.path.join(TEMP_DIR, f"output-{job_id}")
    os.makedirs(output_dir, exist_ok=True)
    
    def log(msg):
        try:
            with open(log_file, 'a', encoding='utf-8') as f:
                f.write(f"[{job_id}] {msg}\n")
        except Exception:
            pass
        try:
            enc = sys.stdout.encoding or 'utf-8'
            print(f"[{job_id}] {msg}".encode(enc, errors='replace').decode(enc))
        except Exception:
            try:
                print(f"[{job_id}] {msg.encode('ascii', errors='replace').decode('ascii')}")
            except Exception:
                pass

    # Detectar proveedor por prefijo del token
    provider = "meshy" if token.startswith("msy_") else "replicate"
    log(f"Proveedor detectado: {provider.upper()} (token: {token[:10]}...)")

    # --- FASE 1: EXTRACCIÓN Y CODIFICACIÓN BASE64 ---
    update_job_status(job_id, "DOWNLOADING", 10)
    log("Preparando y codificando imágenes en formato Base64 Data URI...")
    
    try:
        all_images = []  # Lista de tuplas (data_bytes, mime_type, filename)

        if zipfile.is_zipfile(image_path):
            log("El archivo subido es un paquete ZIP. Buscando fotos válidas en su interior...")
            max_images = 4 if provider == "meshy" else 5
            with zipfile.ZipFile(image_path, 'r') as z:
                image_extensions = (".jpg", ".jpeg", ".png", ".webp")
                for filename in z.namelist():
                    if filename.lower().endswith(image_extensions) and "__macosx" not in filename.lower() and not os.path.basename(filename).startswith("."):
                        img_data = z.read(filename)
                        mime = "image/jpeg"
                        if filename.lower().endswith(".png"):
                            mime = "image/png"
                        elif filename.lower().endswith(".webp"):
                            mime = "image/webp"
                        all_images.append((img_data, mime, os.path.basename(filename)))
                        if len(all_images) >= max_images:
                            break
            if not all_images:
                raise Exception("No se encontró ninguna imagen válida (.jpg, .png, .webp) dentro del archivo ZIP.")
            log(f"Imágenes encontradas dentro del ZIP ({len(all_images)}): {', '.join(f[2] for f in all_images)}")
        else:
            with open(image_path, "rb") as image_file:
                img_data = image_file.read()
            mime = "image/jpeg"
            if image_path.lower().endswith(".png"):
                mime = "image/png"
            elif image_path.lower().endswith(".webp"):
                mime = "image/webp"
            all_images.append((img_data, mime, os.path.basename(image_path)))
            log(f"Imagen cargada: {os.path.basename(image_path)}")

        # Codificar todas las imágenes a Base64 Data URIs
        all_data_uris = []
        for img_data, mime, fname in all_images:
            encoded = base64.b64encode(img_data).decode('utf-8')
            all_data_uris.append(f"data:{mime};base64,{encoded}")

        log(f"Total de {len(all_data_uris)} foto(s) codificada(s) correctamente.")
    except Exception as e:
        log(f"[ERROR] Fallo al extraer o codificar las imágenes: {str(e)}")
        update_job_status(job_id, "FAILED", 100, f"Error de preparación de imagen: {str(e)}")
        return

    # ===============================================================
    #  PROVEEDOR: MESHY (multi-imagen nativo)
    # ===============================================================
    if provider == "meshy":
        # --- FASE 2M: CREAR TAREA EN MESHY ---
        update_job_status(job_id, "RECONSTRUCTING", 30)
        log(f"Conectando con Meshy API (https://api.meshy.ai)...")
        log(f"Enviando {len(all_data_uris)} imagen(es) al modelo multi-vista Meshy-6...")

        meshy_url = "https://api.meshy.ai/openapi/v1/multi-image-to-3d"
        meshy_headers = {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json"
        }
        # Parámetros de calidad: remesh para una malla limpia, PBR para
        # materiales realistas, simetría automática (ideal en coches) y un
        # conteo de polígonos razonable para web.
        meshy_payload = {
            "image_urls": all_data_uris,
            "ai_model": "meshy-6",
            "should_texture": True,
            "should_remesh": True,
            "enable_pbr": True,
            "symmetry_mode": "auto",
            "topology": "triangle",
            "target_polycount": 30000
        }

        try:
            req = urllib.request.Request(
                meshy_url,
                data=json.dumps(meshy_payload).encode('utf-8'),
                headers=meshy_headers,
                method='POST'
            )
            with urllib.request.urlopen(req, context=ssl_context) as response:
                res_data = json.loads(response.read().decode('utf-8'))
                task_id = res_data.get("result") or res_data.get("id")
                log(f"Tarea creada exitosamente en Meshy. Task ID: {task_id}")
                log("Encolada en los servidores GPU de Meshy. Esperando procesamiento multi-vista...")
        except urllib.error.HTTPError as e:
            err_content = e.read().decode('utf-8')
            log(f"[ERROR] Fallo HTTP en Meshy API ({e.code}): {err_content}")
            msg = f"Error en Meshy: {e.reason}"
            if e.code == 401 or e.code == 403:
                msg = "Token de Meshy no autorizado o inválido. Verifica tu API key en meshy.ai"
            update_job_status(job_id, "FAILED", 100, msg)
            return
        except Exception as e:
            log(f"[ERROR] Error al contactar con Meshy: {str(e)}")
            update_job_status(job_id, "FAILED", 100, f"Error de conexión con Meshy: {str(e)}")
            return

        # --- FASE 3M: POLLING DE ESTADO EN MESHY ---
        status_url = f"https://api.meshy.ai/openapi/v1/multi-image-to-3d/{task_id}"
        start_time = time.time()
        timeout = 600  # 10 minutos (Meshy puede tardar más)

        model_urls = None
        while time.time() - start_time < timeout:
            time.sleep(5)
            try:
                req_status = urllib.request.Request(status_url, headers={"Authorization": f"Bearer {token}"}, method='GET')
                with urllib.request.urlopen(req_status, context=ssl_context) as response:
                    status_data = json.loads(response.read().decode('utf-8'))
                    state = status_data.get("status", "UNKNOWN")

                    progress_pct = status_data.get("progress", 0)
                    if progress_pct:
                        log(f"Estado Meshy: {state} ({progress_pct}%)")
                    else:
                        log(f"Estado Meshy: {state}...")

                    if state == "SUCCEEDED":
                        log("[SUCCESS] ¡Procesamiento multi-vista en Meshy finalizado con éxito!")
                        model_urls = status_data.get("model_urls", {})
                        break
                    elif state == "FAILED":
                        error_detail = status_data.get("task_error", {}).get("message", "Error desconocido en Meshy.")
                        log(f"[ERROR] Fallo en Meshy: {error_detail}")
                        update_job_status(job_id, "FAILED", 100, f"Fallo de GPU en Meshy: {error_detail}")
                        return
                    
                    # Progreso visual
                    if state == "PENDING":
                        update_job_status(job_id, "RECONSTRUCTING", 35)
                    elif state == "IN_PROGRESS":
                        mapped_progress = min(40 + int((progress_pct or 0) * 0.4), 80)
                        update_job_status(job_id, "RECONSTRUCTING", mapped_progress)

            except Exception as e:
                log(f"[ADVERTENCIA] Error de red al consultar estado de Meshy: {str(e)}")
                time.sleep(3)
        else:
            log("[ERROR] Tiempo de espera agotado (Timeout) esperando la GPU de Meshy.")
            update_job_status(job_id, "FAILED", 100, "Timeout esperando respuesta de Meshy (10 min).")
            return

        # --- FASE 4M: DESCARGAR MODELO 3D DE MESHY ---
        update_job_status(job_id, "COMPRESSING", 85)
        log(f"Resultado de Meshy model_urls: {json.dumps(model_urls)}")

        # Prioridad: GLB > FBX > OBJ
        glb_url = model_urls.get("glb") or model_urls.get("fbx") or model_urls.get("obj")
        if not glb_url:
            # Fallback: tomar cualquier URL disponible
            for key, val in model_urls.items():
                if isinstance(val, str) and val.startswith("http"):
                    glb_url = val
                    break

        if not glb_url:
            log("[ERROR] Meshy no retornó ninguna URL de archivo 3D válida.")
            update_job_status(job_id, "FAILED", 100, "El modelo Meshy no generó un archivo 3D descargable.")
            return

        ext = ".glb"
        if ".obj" in glb_url.lower():
            ext = ".obj"
        elif ".fbx" in glb_url.lower():
            ext = ".fbx"
        elif ".gltf" in glb_url.lower():
            ext = ".gltf"

        model_filename = f"vehicle-{job_id}{ext}"
        local_model_path = os.path.join(output_dir, model_filename)
        log(f"Descargando modelo 3D final desde Meshy: {glb_url}")

        try:
            req_dl = urllib.request.Request(glb_url, headers={"Authorization": f"Bearer {token}"})
            with urllib.request.urlopen(req_dl, context=ssl_context) as res_dl:
                with open(local_model_path, "wb") as f_glb:
                    f_glb.write(res_dl.read())
            log(f"[SUCCESS] Archivo 3D ({ext}) descargado y guardado localmente en el servidor.")
        except Exception as e:
            log(f"[ERROR] No se pudo descargar el archivo de modelo de Meshy: {str(e)}")
            update_job_status(job_id, "FAILED", 100, f"Error descargando archivo 3D: {str(e)}")
            return

        # --- FASE 5M: COMPLETADO ---
        log("¡Reconstrucción multi-vista por Meshy completada!")
        model_serve_url = f"http://localhost:3000/models/{model_filename}"
        update_job_status(job_id, "COMPLETED", 100, model_url=model_serve_url)
        return

    # ===============================================================
    #  PROVEEDOR: REPLICATE (descubrimiento dinámico)
    # ===============================================================
    # --- FASE 2R: DESCUBRIMIENTO DINÁMICO DE MODELO + LLAMADA A REPLICATE ---
    update_job_status(job_id, "RECONSTRUCTING", 30)
    log("Consultando modelos 3D disponibles en Replicate...")

    replicate_url = "https://api.replicate.com/v1/predictions"
    headers = {
        "Authorization": f"Token {token}",
        "Content-Type": "application/json"
    }

    def get_model_version(model_name):
        try:
            req = urllib.request.Request(
                f"https://api.replicate.com/v1/models/{model_name}",
                headers={"Authorization": f"Token {token}"},
                method="GET"
            )
            with urllib.request.urlopen(req, context=ssl_context, timeout=10) as resp:
                mdata = json.loads(resp.read().decode('utf-8'))
                ver = mdata.get("latest_version", {})
                ver_id = ver.get("id")
                schema = ver.get("openapi_schema", {}).get("components", {}).get("schemas", {}).get("Input", {})
                input_keys = list(schema.get("properties", {}).keys())
                return ver_id, input_keys
        except Exception:
            return None, []

    chosen_model = None
    chosen_version = None
    chosen_payload_input = None

    multi_view_models = ["hyper3d/rodin", "tencent/hunyuan3d-2"]
    single_image_models = ["vaibhavs10/instantmesh", "camenduru/instant-mesh", "lucataco/stable-fast-3d", "lucataco/unique3d"]

    if len(all_data_uris) > 1:
        for model_name in multi_view_models:
            log(f"  Probando modelo multi-vista: {model_name}...")
            ver_id, input_keys = get_model_version(model_name)
            if ver_id:
                log(f"  ✓ {model_name} disponible (versión: {ver_id[:16]}..., inputs: {input_keys})")
                chosen_model = model_name
                chosen_version = ver_id
                # Enviar TODAS las imágenes si el modelo acepta un array de vistas.
                # (Antes solo se mandaba la primera y se desperdiciaban los demás ángulos.)
                array_key = next((k for k in ("images", "input_images", "image_urls", "view_images") if k in input_keys), None)
                if array_key:
                    chosen_payload_input = {array_key: all_data_uris}
                    log(f"  → Enviando las {len(all_data_uris)} vistas al campo '{array_key}'.")
                elif "image" in input_keys:
                    chosen_payload_input = {"image": all_data_uris[0]}
                else:
                    chosen_payload_input = {"image": all_data_uris[0]}
                if "prompt" in input_keys:
                    chosen_payload_input["prompt"] = "high quality detailed vehicle, 3d model, clean mesh"
                _add_bg_removal(chosen_payload_input, input_keys)
                break
            else:
                log(f"  ✗ {model_name} no disponible para tu cuenta.")

    if not chosen_model:
        for model_name in single_image_models:
            log(f"  Probando modelo single-image: {model_name}...")
            ver_id, input_keys = get_model_version(model_name)
            if ver_id:
                log(f"  ✓ {model_name} disponible (versión: {ver_id[:16]}..., inputs: {input_keys})")
                chosen_model = model_name
                chosen_version = ver_id
                if "image_path" in input_keys:
                    chosen_payload_input = {"image_path": all_data_uris[0], "export_texmap": True, "sample_steps": 75}
                elif "image" in input_keys:
                    chosen_payload_input = {"image": all_data_uris[0]}
                else:
                    chosen_payload_input = {"image_path": all_data_uris[0]}
                _add_bg_removal(chosen_payload_input, input_keys)
                break
            else:
                log(f"  ✗ {model_name} no disponible.")

    if not chosen_model:
        log("  Ningún modelo descubierto dinámicamente. Usando InstantMesh con versión fija conocida.")
        chosen_model = "vaibhavs10/instantmesh"
        chosen_version = "e353a25cc764e0edb0aa9033df0bf4b82318dcda6d0a0cd9f2aace90566068ac"
        chosen_payload_input = {"image_path": all_data_uris[0], "export_texmap": True, "sample_steps": 75}

    log(f"Lanzando modelo de IA: {chosen_model} (versión: {chosen_version[:16]}...) en GPU...")

    payload = {"version": chosen_version, "input": chosen_payload_input}

    try:
        req = urllib.request.Request(
            replicate_url,
            data=json.dumps(payload).encode('utf-8'),
            headers=headers,
            method='POST'
        )
        with urllib.request.urlopen(req, context=ssl_context) as response:
            res_data = json.loads(response.read().decode('utf-8'))
            prediction_id = res_data["id"]
            log(f"Predicción creada exitosamente en Replicate. ID de Predicción: {prediction_id}")
            log("Encolada en los servidores GPU de Replicate. Esperando turno de ejecución...")
    except urllib.error.HTTPError as e:
        err_content = e.read().decode('utf-8')
        log(f"[ERROR] Fallo HTTP en Replicate API ({e.code}): {err_content}")
        msg = f"Error en Replicate: {e.reason}"
        if e.code == 401:
            msg = "Token de Replicate no autorizado o inválido. Revisa tu cuenta de Replicate."
        elif e.code == 422:
            msg = f"Modelo {chosen_model} rechazó los parámetros. Detalle: {err_content}"
        update_job_status(job_id, "FAILED", 100, msg)
        return
    except Exception as e:
        log(f"[ERROR] Error al contactar con Replicate: {str(e)}")
        update_job_status(job_id, "FAILED", 100, f"Error de conexión: {str(e)}")
        return

    # --- FASE 3R: POLLING DE ESTADO A REPLICATE ---
    status_url = f"https://api.replicate.com/v1/predictions/{prediction_id}"
    req_status = urllib.request.Request(status_url, headers={"Authorization": f"Token {token}"}, method='GET')
    
    start_time = time.time()
    timeout = 300

    while time.time() - start_time < timeout:
        time.sleep(3)
        try:
            with urllib.request.urlopen(req_status, context=ssl_context) as response:
                status_data = json.loads(response.read().decode('utf-8'))
                state = status_data["status"]
                
                replicate_logs = status_data.get("logs", "")
                if replicate_logs:
                    log_lines = replicate_logs.strip().split("\n")[-3:]
                    for line in log_lines:
                        log(f"[GPU REPLICATE] {line}")
                else:
                    log(f"Estado de la GPU en Replicate: {state}...")

                if state == "succeeded":
                    log("[SUCCESS] ¡Procesamiento de IA en Replicate finalizado con éxito!")
                    output = status_data.get("output", [])
                    break
                elif state == "failed":
                    error_detail = status_data.get("error", "Error desconocido en el contenedor de Replicate.")
                    log(f"[ERROR] La ejecución en la GPU falló: {error_detail}")
                    update_job_status(job_id, "FAILED", 100, f"Fallo de GPU en Replicate: {error_detail}")
                    return
                elif state == "canceled":
                    log("[ERROR] La tarea fue cancelada en Replicate.")
                    update_job_status(job_id, "FAILED", 100, "Tarea cancelada en Replicate.")
                    return
                
                if state == "starting":
                    update_job_status(job_id, "RECONSTRUCTING", 40)
                elif state == "processing":
                    update_job_status(job_id, "RECONSTRUCTING", 60)

        except Exception as e:
            log(f"[ADVERTENCIA] Error de red al consultar estado: {str(e)}")
            time.sleep(2)
    else:
        log("[ERROR] Tiempo de espera agotado (Timeout) esperando la GPU de Replicate.")
        update_job_status(job_id, "FAILED", 100, "Timeout esperando respuesta de Replicate.")
        return

    # --- FASE 4R: DESCARGAR ARCHIVO DE MODELO 3D ---
    update_job_status(job_id, "COMPRESSING", 80)
    log("Buscando archivo de modelo 3D en el resultado de salida...")

    glb_url = None
    if isinstance(output, list):
        for item in output:
            if isinstance(item, str) and (".glb" in item.lower() or ".gltf" in item.lower()):
                glb_url = item
                break
        if not glb_url:
            for item in output:
                if isinstance(item, str) and ".obj" in item.lower():
                    glb_url = item
                    break
        if not glb_url:
            for item in output:
                if isinstance(item, str) and not any(ext in item.lower() for ext in [".png", ".jpg", ".jpeg", ".webp", ".mp4"]):
                    glb_url = item
                    break
        if not glb_url and len(output) > 0:
            glb_url = output[0]
    elif isinstance(output, dict):
        for key, val in output.items():
            if isinstance(val, str) and (".glb" in val.lower() or ".gltf" in val.lower()):
                glb_url = val
                break
        if not glb_url:
            for key, val in output.items():
                if isinstance(val, str) and ".obj" in val.lower():
                    glb_url = val
                    break
        if not glb_url:
            for key, val in output.items():
                if isinstance(val, str) and not any(ext in val.lower() for ext in [".png", ".jpg", ".jpeg", ".webp", ".mp4"]):
                    glb_url = val
                    break
    elif isinstance(output, str):
        glb_url = output

    if not glb_url:
        log("[ERROR] Replicate no retornó ninguna URL de archivo 3D válida.")
        update_job_status(job_id, "FAILED", 100, "El modelo no generó un archivo 3D legible.")
        return

    ext = ".glb"
    if ".obj" in glb_url.lower():
        ext = ".obj"
    elif ".gltf" in glb_url.lower():
        ext = ".gltf"

    model_filename = f"vehicle-{job_id}{ext}"
    local_model_path = os.path.join(output_dir, model_filename)
    log(f"Descargando modelo 3D final desde los servidores de Replicate: {glb_url}")

    try:
        req_dl = urllib.request.Request(glb_url)
        with urllib.request.urlopen(req_dl, context=ssl_context) as res_dl:
            with open(local_model_path, "wb") as f_glb:
                f_glb.write(res_dl.read())
        log(f"[SUCCESS] Archivo 3D ({ext}) descargado y guardado localmente en el servidor.")
    except Exception as e:
        log(f"[ERROR] No se pudo descargar el archivo de modelo de Replicate: {str(e)}")
        update_job_status(job_id, "FAILED", 100, f"Error descargando archivo 3D: {str(e)}")
        return

    # --- FASE 5R: COMPLETADO ---
    log("¡Reconstrucción por Inteligencia Artificial completada!")
    model_serve_url = f"http://localhost:3000/models/{model_filename}"
    update_job_status(job_id, "COMPLETED", 100, model_url=model_serve_url)

def run_server():
    server_address = ('', PORT)
    httpd = HTTPServer(server_address, BackendAPIHandler)
    print("===========================================================")
    print(f"   SERVIDOR HTTP 3D SCANNER CORRIENDO EN http://localhost:{PORT}")
    print("===========================================================")
    print("   Proveedores soportados:")
    print("   -> Token msy_... = Meshy (multi-imagen, hasta 4 fotos)")
    print("   -> Token r8_...  = Replicate (descubrimiento dinámico)")
    print("   Endpoints listos:")
    print(f"   -> POST http://localhost:{PORT}/api/upload?vehicleId=...&token=...")
    print(f"   -> GET  http://localhost:{PORT}/api/status/:jobId")
    print(f"   -> GET  http://localhost:{PORT}/models/vehicle-:jobId.glb")
    print("===========================================================\n")
    sys.stdout.flush()
    httpd.serve_forever()

if __name__ == "__main__":
    run_server()

