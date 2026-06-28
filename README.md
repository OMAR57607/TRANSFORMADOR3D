# TRANSFORMADOR3D — Escáner y Visor 3D de Vehículos

Plataforma **local** que transforma **fotos 2D → modelo 3D** de vehículos usando IA en la nube
(Meshy o Replicate), y los muestra en un visor interactivo hecho con Three.js. Además incluye un
**visor 360°** que gira tus fotos reales sin usar IA.

> ⚠️ Es un proyecto **local** (corre en tu PC con un servidor Python). **No** está desplegado en
> ningún servicio en la nube (no usa Vercel ni similares).

---

## 🚀 Cómo ejecutarlo

Necesitas **Python 3** (no requiere `pip install`, usa solo librerías estándar).

```bash
# Desde la raíz del proyecto (carpeta TRANSFORMADOR3D)
python3 apps/backend/src/server.py
```

Luego abre el navegador en:

```
http://localhost:3000
```

Para detenerlo: `Ctrl + C` en la terminal.

> El archivo que levanta el servidor real es **`apps/backend/src/server.py`**.
> ⚠️ **No** uses `pnpm --filter ...backend start` ni `ts-node index.ts`: eso ejecuta un archivo de
> demo distinto, **no** el servidor real.

---

## 🧩 Los dos modos del visor

La interfaz tiene un selector **"Modo del Visor"**:

### 1. Modo **3D (IA)**
Reconstruye una **malla 3D** a partir de tus fotos usando IA en la nube.
- Sube **fotos** del vehículo (`.jpg`/`.png`), un **`.zip`** de fotos, o un modelo **`.glb`** ya hecho.
- Necesita un **token de API** (ver abajo).
- La IA genera el modelo 3D, se descarga y se muestra en el visor (rota solo, color de carrocería,
  reflejos HDRI, sombras, cámaras).

### 2. Modo **360° (Fotos)**
Gira **tus fotos reales** como si el coche girara. **No usa IA ni token, es gratis.**
- Sube **varias fotos** (o un `.zip`). Cuantas más fotos (ideal 24-36), **más suave** el giro.
- Con pocas fotos (4-5) el giro se ve a saltos: es normal, son pocos fotogramas.
- Arrastra con el ratón o el dedo para girar.

---

## 💾 Descargar el modelo 3D (.glb)

En el panel izquierdo, **"Descargar Modelo 3D (.glb)"** baja a tu equipo el modelo que estás viendo,
en tres calidades:

- **Alta**: original (geometría y textura completas).
- **Media**: textura reducida a 1024px (archivo más ligero).
- **Baja**: textura reducida a 512px (el más ligero).

Se exporta en el navegador con `GLTFExporter` (sin servidor). Sirve para cualquier modelo cargado en el
visor 3D: generado por IA o un `.glb` que hayas subido. La descarga `.glb` no aplica al modo 360°
(ahí son fotos, no un modelo 3D).

---

## 🔑 Proveedores de IA (modo 3D)

El proveedor se detecta automáticamente por el **prefijo del token** que escribes en la interfaz:

| Token empieza con | Proveedor | Notas |
|---|---|---|
| `msy_...` | **[Meshy](https://www.meshy.ai/api)** | Multi-imagen nativo (hasta 4 fotos). Modelo `meshy-6`. **Recomendado.** |
| `r8_...` | **[Replicate](https://replicate.com/keys)** | Descubrimiento dinámico de modelos (Rodin, Hunyuan3D-2, InstantMesh…). |

El token se guarda en el navegador (`localStorage`) y se manda al servidor local, que hace las
llamadas a la API del proveedor.

---

## 📁 Estructura del proyecto

```
TRANSFORMADOR3D/
├── apps/
│   ├── backend/
│   │   └── src/
│   │       ├── server.py          ← ★ SERVIDOR REAL (Python). Sirve la web + API + IA.
│   │       ├── index.ts           ← demo en TypeScript (NO es el servidor real)
│   │       └── ...                ← clases de Clean Architecture (mayormente andamiaje)
│   ├── web/                        ← ★ FRONTEND (lo que ves en el navegador)
│   │   ├── index.html
│   │   ├── css/style.css
│   │   └── js/
│   │       ├── app.js                    ← orquestador: conecta UI con los visores
│   │       ├── ThreeJsVehicleRenderer.js ← visor 3D (Three.js)
│   │       └── Spinner360Viewer.js       ← visor 360° (canvas 2D)
│   └── mobile/                     ← app React Native (SIMULADA, ver notas)
├── packages/core/                  ← dominio TS (Clean Architecture, mayormente mocks)
├── README.md
└── CLAUDE.md                        ← contexto técnico para agentes/IA
```

---

## 🛠️ Cómo funciona el modo 3D (por dentro)

1. El frontend (`app.js`) sube las fotos a `POST http://localhost:3000/api/upload`.
2. `server.py` lanza un hilo (`run_3d_prediction`) que:
   - Codifica las imágenes a Base64.
   - Llama a Meshy o Replicate según el token.
   - Hace *polling* del estado de la tarea.
   - Descarga el modelo 3D (`.glb`/`.obj`) a `apps/backend/temp/`.
3. El frontend consulta `GET /api/status/:jobId` y, al terminar, carga el modelo en el visor.

---

## ⚠️ Notas honestas / limitaciones

Para que no haya sorpresas:

- **Los vehículos del desplegable son DEMO, no son reales.** Al abrir verás un **Ferrari de muestra**
  (un modelo de ejemplo de la librería three.js) y la opción "Tacoma" carga un **camioncito genérico**
  (Cesium Milk Truck). **No existen modelos reales de Tacoma/Hilux/4Runner**: el propósito de la app es
  que TÚ los **generes** subiendo fotos. El desplegable solo sirve como etiqueta/relleno.
- **La app móvil (`apps/mobile`) está SIMULADA**: muestra progreso falso con temporizadores, no captura
  ni sube nada real.
- **`packages/core`** (interfaces y mocks de Clean Architecture) está **desconectado** del servidor real;
  el trabajo de verdad ocurre en `server.py`.
- **Seguridad**: el servidor desactiva la verificación SSL y el token viaja en la URL. Está bien para una
  demo local, **no** para producción.
- La **calidad de la malla 3D** depende mucho de las fotos (fondo limpio, buena luz) y del proveedor.
  Los coches son de los objetos más difíciles de reconstruir (brillantes, grandes, piezas finas).

---

## 📦 Monorepo (opcional)

Es un monorepo `pnpm`, pero para **usar la app solo necesitas Python** (el comando de arriba).
Los `package.json` y la estructura TS son andamiaje/demo y no hacen falta para el flujo principal.
