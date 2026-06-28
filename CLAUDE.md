# CLAUDE.md — Contexto del proyecto TRANSFORMADOR3D

Contexto técnico para agentes/IA que trabajen en este repo. Léelo antes de tocar código.

## Qué es

App **local** que convierte **fotos 2D → modelo 3D** de vehículos (vía IA de Meshy/Replicate) y los
muestra en un visor Three.js. Incluye además un **visor 360°** que gira fotos reales sin IA.

**Es local. NO hay despliegue en la nube. NO usar Vercel** (se retiró deliberadamente; no volver a
añadir `vercel.json` ni una carpeta `api/` de funciones serverless salvo que el usuario lo pida
explícitamente).

## Cómo se ejecuta

```bash
python3 apps/backend/src/server.py   # servidor real, puerto 3000
# abrir http://localhost:3000
```

- El servidor real es **`apps/backend/src/server.py`** (Python, solo stdlib, sin dependencias).
- **OJO:** `apps/backend/src/index.ts` y `pnpm --filter ...backend start` son una **demo TS aparte**,
  NO el servidor real. No confundir.

## Mapa de archivos clave

| Archivo | Rol |
|---|---|
| `apps/backend/src/server.py` | ★ Servidor HTTP. Sirve `apps/web`, expone la API y llama a Meshy/Replicate en un hilo. |
| `apps/web/index.html` | UI (paneles glassmorphism, toggle de modo de visor, zona de subida). |
| `apps/web/js/app.js` | Orquestador. Conecta UI ↔ visores, maneja subida/polling y los dos modos. |
| `apps/web/js/ThreeJsVehicleRenderer.js` | Visor 3D (Three.js): carga GLB/OBJ, materiales, luces, cámara. Incluye `exportGLB(maxTextureSize)` para descargar el modelo (usa `GLTFExporter`; calidades = reducir textura). |
| `apps/web/js/Spinner360Viewer.js` | Visor 360° (canvas 2D): gira una secuencia de fotos al arrastrar. |
| `apps/web/css/style.css` | Estilos. `#canvas-container` (3D) y `#spinner-container` (360°) comparten capa. |

## API del servidor (`server.py`)

- `POST /api/upload?vehicleId=&token=` → guarda la imagen, lanza `run_3d_prediction` en un hilo, devuelve `jobId`.
- `GET  /api/status/:jobId` → estado del job + logs en vivo.
- `GET  /api/jobs` → lista de jobs (lee JSONs de `apps/backend/temp/`).
- `GET  /models/:nombre` → sirve el modelo descargado.
- Estado y logs se guardan como archivos en `apps/backend/temp/` (no hay base de datos).

## Proveedores de IA (detección por prefijo de token)

- `msy_...` → **Meshy** `multi-image-to-3d`, modelo `meshy-6`, `should_texture:true`, hasta 4 imágenes.
- `r8_...` → **Replicate**, descubrimiento dinámico: multi-vista (`hyper3d/rodin`, `tencent/hunyuan3d-2`)
  o single-image (`vaibhavs10/instantmesh`, etc.). Lee el schema del modelo antes de elegir el payload.

## Frontend: los dos modos (en `app.js`)

- Estado `viewerMode`: `'3d'` | `'360'`. `setViewerMode()` muestra/oculta `#canvas-container` vs `#spinner-container`.
- **360°**: `extractImageFrames()` (usa **JSZip** para `.zip`) → `Spinner360Viewer.loadFrames()`. Sin IA, sin servidor.
- **3D**: `.glb/.gltf` se cargan directos; fotos/`.zip` van al servidor local (`/api/upload`) → polling → `renderer.loadModel()`.

## ⚠️ Qué es REAL y qué es DEMO (importante, el usuario es sensible a esto)

- **Modelos "stock" del desplegable = DEMO.** `ThreeJsVehicleRenderer.js` mapea:
  - `'tacoma'` → `CesiumMilkTruck.glb` (camioncito genérico de Khronos).
  - cualquier otro → `ferrari.glb` (ejemplo de three.js).
  - **NO existen modelos reales de Tacoma/Hilux/4Runner.** Los modelos reales salen de la generación con fotos.
  - No sugerir "comprar modelos": el propósito de la app es **generarlos**.
- **`apps/mobile/App.tsx` = SIMULACIÓN** (progreso falso con `setTimeout`, sin captura ni red real).
- **`packages/core`** = interfaces + mocks de Clean Architecture, **desconectado** de `server.py`.

## Baches conocidos / deuda técnica

- `ThreeJsVehicleRenderer.setCarColor()` llama a `addLog()`, que vive en el scope de `app.js` (vía `window.addLog`
  si se expone). Verificar que esté disponible globalmente antes de asumirlo.
- URLs de modelos de Replicate **caducan** (~1 h); cualquier "biblioteca" de modelos guardada puede quedar con enlaces muertos.
- Los coches son el peor caso para foto→3D (brillantes, grandes, piezas finas). Gestionar expectativas de calidad.
- SV3D (giro 360° por IA desde 1 foto) **no** está disponible de forma limpia en Replicate (licencia/no publicado).
  Zero123++ existe pero da solo 6 vistas fijas.

## Convenciones

- Idioma del proyecto: **español** (UI, comentarios, logs).
- Sin paso de build para el frontend: HTML/CSS/JS plano servido por `server.py`.
- Three.js y JSZip se cargan por **CDN** desde `index.html`.
