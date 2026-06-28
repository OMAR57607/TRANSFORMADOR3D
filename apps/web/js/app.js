/**
 * Orquestador de la aplicación Web Frontend.
 *
 * Vincula la interfaz HTML (paneles de control, barra de progreso, consola)
 * con dos visores:
 *   - ThreeJsVehicleRenderer: modo 3D (malla reconstruida por IA Meshy/Replicate).
 *   - Spinner360Viewer: modo 360° (gira tus fotos reales, sin IA ni servidor).
 */
// --- CAPTURA DE ERRORES GLOBALES EN PANTALLA ---
window.addEventListener('error', (event) => {
  const consoleEl = document.getElementById('log-console');
  if (consoleEl) {
    const line = document.createElement('div');
    line.className = 'log-line';
    line.style.color = '#ef4444'; // Rojo para indicar error
    const now = new Date().toLocaleTimeString();
    line.innerText = `[${now}] [ERROR RUNTIME] ${event.message} en ${event.filename.split('/').pop() || 'script'}:${event.lineno}`;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }
});

document.addEventListener('DOMContentLoaded', () => {
  // Instanciar los dos visores
  const renderer = new ThreeJsVehicleRenderer();
  const spinner = new Spinner360Viewer('spinner-container');

  // Estado del modo de visor: '3d' (IA) o '360' (fotos)
  let viewerMode = '3d';
  // Archivos seleccionados (por examinar o por arrastrar) - fuente única de verdad
  let selectedFiles = [];

  // Elementos del DOM
  const vehicleSelect = document.getElementById('vehicle-select');
  const replicateTokenInput = document.getElementById('replicate-token');
  const uploadZone = document.getElementById('upload-zone');
  const fileInput = document.getElementById('file-input');
  const fileInfo = document.getElementById('file-info');
  const btnBrowse = document.getElementById('btn-browse');

  // Elementos del Modo del Visor (3D / 360°)
  const btnViewer3d = document.getElementById('btn-viewer-3d');
  const btnViewer360 = document.getElementById('btn-viewer-360');
  const canvasContainer = document.getElementById('canvas-container');
  const spinnerContainer = document.getElementById('spinner-container');

  // Elementos del Modo de Visualización 3D (Malla IA / CAD)
  const btnModeIa = document.getElementById('btn-mode-ia');
  const btnModeHd = document.getElementById('btn-mode-hd');
  let activeModelUrl = ''; // Guarda la URL de la malla IA cargada actualmente

  // Cargar token de API guardado en localStorage
  if (replicateTokenInput) {
    replicateTokenInput.value = localStorage.getItem('replicate_token') || '';
  }
  const btnStart = document.getElementById('btn-start-process');
  const progressContainer = document.getElementById('progress-container');
  const progressStep = document.getElementById('progress-step');
  const progressPercent = document.getElementById('progress-percent');
  const progressBarFill = document.getElementById('progress-bar-fill');

  const toggleHdri = document.getElementById('toggle-hdri');
  const toggleShadows = document.getElementById('toggle-shadows');
  const colorDots = document.querySelectorAll('.color-dot');

  const camFront = document.getElementById('cam-front');
  const camSide = document.getElementById('cam-side');
  const camTop = document.getElementById('cam-top');
  const camIsometric = document.getElementById('cam-isometric');
  const btnResetCam = document.getElementById('btn-reset-cam');

  const logConsole = document.getElementById('log-console');

  // Inicializar visor 3D con el modelo correspondiente a la selección inicial
  renderer.initialize('canvas-container', { enableShadows: true })
    .then(() => {
      addLog('Visor 3D WebGL cargado correctamente con aceleración por hardware.', 'system');

      const modelKey = vehicleSelect.value === 'toyota-tacoma-2024' ? 'tacoma' : 'default';
      renderer.loadModel(modelKey, (percent) => {
        if (percent === 100) {
          addLog('Modelo 3D de previsualización inicial listo.', 'success');
        }
      }).catch(err => {
        addLog(`Error al cargar modelo inicial: ${err.message || err}`, 'error');
      });
      // Cargar historial de escaneos
      loadHistory();
    })
    .catch(err => {
      console.error(err);
      addLog(`Error al inicializar WebGL: ${err.message}`, 'error');
    });

  // Cambiar modelo en tiempo real al seleccionar otro vehículo de la lista
  vehicleSelect.addEventListener('change', (e) => {
    const selectedVal = e.target.value;
    const modelKey = selectedVal === 'toyota-tacoma-2024' ? 'tacoma' : 'default';
    addLog(`Cargando modelo de referencia para: ${e.target.options[e.target.selectedIndex].text}...`, 'system');
    if (viewerMode === '3d') {
      renderer.loadModel(modelKey).catch(err => {
        addLog(`Error al cambiar modelo: ${err.message || err}`, 'error');
      });
    }
  });

  // --- REGISTRO DE LOGS EN CONSOLA ---
  function addLog(message, type = 'default') {
    const line = document.createElement('div');
    line.className = `log-line ${type}`;
    const now = new Date().toLocaleTimeString();
    line.innerText = `[${now}] ${message}`;
    logConsole.appendChild(line);
    logConsole.scrollTop = logConsole.scrollHeight; // Autoscroll al final
  }

  // --- VERIFICACIÓN DE LIBRERÍAS ---
  if (typeof THREE === 'undefined') {
    addLog('Error crítico: La librería principal Three.js no se cargó.', 'error');
  } else {
    if (typeof THREE.OrbitControls === 'undefined') addLog('Advertencia: OrbitControls no se cargó.', 'error');
    if (typeof THREE.GLTFLoader === 'undefined') addLog('Advertencia: GLTFLoader no se cargó.', 'error');
    if (typeof THREE.DRACOLoader === 'undefined') addLog('Advertencia: DRACOLoader no se cargó.', 'error');
    if (typeof THREE.OBJLoader === 'undefined') addLog('Advertencia: OBJLoader no se cargó.', 'error');
  }
  if (typeof JSZip === 'undefined') {
    addLog('Advertencia: JSZip no se cargó; el modo 360° no podrá abrir archivos .zip.', 'system');
  }

  // --- SELECTOR DE MODO DEL VISOR (3D / 360°) ---
  function setViewerMode(mode) {
    viewerMode = mode;
    const floatingCam = document.querySelector('.floating-camera-controls');

    if (mode === '360') {
      btnViewer360.classList.add('btn-primary');
      btnViewer360.classList.remove('btn-outline');
      btnViewer3d.classList.add('btn-outline');
      btnViewer3d.classList.remove('btn-primary');

      if (canvasContainer) canvasContainer.style.display = 'none';
      if (spinnerContainer) spinnerContainer.style.display = 'block';
      if (floatingCam) floatingCam.style.display = 'none';

      fileInput.setAttribute('multiple', 'true');
      // Reajustar el lienzo del spinner una vez que el contenedor es visible
      requestAnimationFrame(() => spinner._resize());
      addLog('Modo del visor: 360° (gira tus fotos reales, sin IA y sin servidor).', 'system');
    } else {
      btnViewer3d.classList.add('btn-primary');
      btnViewer3d.classList.remove('btn-outline');
      btnViewer360.classList.add('btn-outline');
      btnViewer360.classList.remove('btn-primary');

      if (canvasContainer) canvasContainer.style.display = 'block';
      if (spinnerContainer) spinnerContainer.style.display = 'none';
      if (floatingCam) floatingCam.style.display = 'flex';

      fileInput.removeAttribute('multiple');
      addLog('Modo del visor: 3D (reconstrucción por IA Meshy/Replicate).', 'system');
    }
  }

  if (btnViewer3d && btnViewer360) {
    btnViewer3d.addEventListener('click', () => setViewerMode('3d'));
    btnViewer360.addEventListener('click', () => setViewerMode('360'));
  }

  // --- NAVEGACIÓN Y CARGA DE ARCHIVOS ---
  btnBrowse.addEventListener('click', () => fileInput.click());
  uploadZone.addEventListener('click', (e) => {
    if (e.target !== btnBrowse) fileInput.click();
  });

  fileInput.addEventListener('change', (e) => {
    selectedFiles = Array.from(e.target.files || []);
    handleFileSelection();
  });

  // Drag & Drop
  uploadZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    uploadZone.classList.add('dragover');
  });

  uploadZone.addEventListener('dragleave', () => {
    uploadZone.classList.remove('dragover');
  });

  uploadZone.addEventListener('drop', (e) => {
    e.preventDefault();
    uploadZone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      selectedFiles = Array.from(e.dataTransfer.files);
      handleFileSelection();
    }
  });

  function handleFileSelection() {
    if (selectedFiles.length === 0) return;
    if (selectedFiles.length === 1) {
      const f = selectedFiles[0];
      fileInfo.innerText = `${f.name} (${(f.size / 1024 / 1024).toFixed(2)} MB)`;
    } else {
      fileInfo.innerText = `${selectedFiles.length} archivos seleccionados`;
    }
    btnStart.removeAttribute('disabled');
    addLog(`Captura cargada en memoria: ${selectedFiles.length} archivo(s). Listo para procesar.`, 'system');
  }

  /**
   * Extrae los fotogramas de imagen (para el modo 360°) a partir de los
   * archivos seleccionados: acepta imágenes sueltas y/o un .zip de fotos.
   * Devuelve un array de blob URLs ordenado por nombre de archivo.
   */
  async function extractImageFrames(files) {
    const entries = []; // { name, url }
    for (const file of files) {
      if (/\.zip$/i.test(file.name)) {
        if (typeof JSZip === 'undefined') {
          throw new Error('JSZip no se cargó; no puedo abrir el archivo .zip.');
        }
        const zip = await JSZip.loadAsync(file);
        const zipEntries = [];
        zip.forEach((path, entry) => {
          const base = path.split('/').pop();
          if (/\.(jpe?g|png|webp)$/i.test(path) &&
              !path.toLowerCase().includes('__macosx') &&
              base && !base.startsWith('.')) {
            zipEntries.push(entry);
          }
        });
        for (const entry of zipEntries) {
          const blob = await entry.async('blob');
          entries.push({ name: entry.name, url: URL.createObjectURL(blob) });
        }
      } else if (/\.(jpe?g|png|webp)$/i.test(file.name)) {
        entries.push({ name: file.name, url: URL.createObjectURL(file) });
      }
    }
    // Ordenar por nombre de forma natural (foto1, foto2, ... foto10)
    entries.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    return entries.map((e) => e.url);
  }

  // --- EJECUCIÓN DEL FLUJO PRINCIPAL ---
  btnStart.addEventListener('click', async () => {
    if (selectedFiles.length === 0) {
      addLog('Error: Selecciona o arrastra al menos un archivo antes de comenzar.', 'error');
      return;
    }

    // =========================================================
    //  MODO 360° (2D) - Construye un spinner de fotos, sin IA
    // =========================================================
    if (viewerMode === '360') {
      btnStart.setAttribute('disabled', 'true');
      btnBrowse.setAttribute('disabled', 'true');
      progressContainer.style.display = 'block';
      addLog('[360°] Construyendo visor de fotos interactivo (sin IA, sin servidor)...', 'system');

      try {
        updateProgress('Leyendo imágenes...', 10);
        const frameUrls = await extractImageFrames(selectedFiles);
        if (frameUrls.length === 0) {
          throw new Error('No se encontraron imágenes válidas (.jpg, .png, .webp).');
        }
        if (frameUrls.length < 2) {
          addLog('[360°] Aviso: con 1 sola imagen no hay giro. Sube varias fotos tomadas alrededor del coche.', 'system');
        }
        addLog(`[360°] ${frameUrls.length} fotograma(s) listo(s).`, 'success');

        await spinner.loadFrames(frameUrls, (p) => updateProgress('Cargando fotogramas...', p));
        addLog('[360°] ¡Visor 360° listo! Arrastra con el ratón o el dedo para girar el vehículo.', 'success');
      } catch (err) {
        addLog(`[360°] Error: ${err.message}`, 'error');
      } finally {
        progressContainer.style.display = 'none';
        btnStart.removeAttribute('disabled');
        btnBrowse.removeAttribute('disabled');
      }
      return;
    }

    // =========================================================
    //  MODO 3D (IA) - Reconstrucción con backend local
    // =========================================================
    const file = selectedFiles[0];

    // SI EL ARCHIVO ES UN MODELO 3D REAL (.GLB o .GLTF), CARGARLO NATIVAMENTE
    if (file.name.endsWith('.glb') || file.name.endsWith('.gltf')) {
      btnStart.setAttribute('disabled', 'true');
      btnBrowse.setAttribute('disabled', 'true');
      progressContainer.style.display = 'block';
      addLog(`[VISOR 3D] Detectado modelo 3D local: ${file.name}`, 'system');
      addLog(`[VISOR 3D] Leyendo y cargando archivo en memoria WebGL...`, 'system');

      try {
        const objectUrl = URL.createObjectURL(file);

        // Simular progreso rápido de lectura de archivo local
        for (let p = 10; p <= 100; p += 30) {
          updateProgress('Cargando modelo local...', Math.min(p, 100));
          await sleep(100);
        }

        await renderer.loadModel(objectUrl, (loadingPercent) => {
          updateProgress('Renderizando malla...', loadingPercent);
        });

        addLog(`[VISOR 3D] ¡Tu modelo '${file.name}' se ha renderizado con éxito!`, 'success');
      } catch (err) {
        addLog(`[ERROR VISOR] No se pudo renderizar tu archivo GLB: ${err.message}`, 'error');
      } finally {
        progressContainer.style.display = 'none';
        btnStart.removeAttribute('disabled');
        btnBrowse.removeAttribute('disabled');
      }
      return;
    }

    // SI EL ARCHIVO ES UN PAQUETE ZIP O IMAGEN, SE ENVÍA AL PIPELINE DE RECONSTRUCCIÓN REAL
    btnStart.setAttribute('disabled', 'true');
    btnBrowse.setAttribute('disabled', 'true');
    progressContainer.style.display = 'block';

    addLog(`[UPLOADER] Conectando con el servidor HTTP local: http://localhost:3000...`, 'system');
    addLog(`[UPLOADER] Iniciando subida binaria real de: ${file.name} (${(file.size / 1024 / 1024).toFixed(2)} MB)...`, 'upload');

    try {
      // 1. Guardar token y preparar Petición POST real al endpoint de subida
      const tokenVal = replicateTokenInput ? replicateTokenInput.value.trim() : '';
      if (replicateTokenInput) {
        localStorage.setItem('replicate_token', tokenVal);
      }

      const vehicleId = vehicleSelect.value;
      const uploadUrl = `http://localhost:3000/api/upload?vehicleId=${encodeURIComponent(vehicleId)}&filename=${encodeURIComponent(file.name)}&token=${encodeURIComponent(tokenVal)}`;

      const response = await fetch(uploadUrl, {
        method: 'POST',
        body: file // Sube el archivo binario directamente al stream del servidor
      });

      if (!response.ok) {
        let serverMsg = response.statusText;
        try {
          const errData = await response.json();
          if (errData && errData.error) serverMsg = errData.error;
        } catch (_) { /* respuesta no-JSON */ }
        throw new Error(serverMsg);
      }

      const result = await response.json();
      if (!result.success) {
        throw new Error(result.error || 'Error desconocido al subir archivo.');
      }

      const jobId = result.jobId;
      addLog(`[UPLOADER] Subida exitosa. Tarea encolada en el servidor con ID: ${jobId}`, 'success');

      // 2. Iniciar Polling de estado al backend
      let lastLogIndex = 0;
      const pollInterval = setInterval(async () => {
        try {
          const statusRes = await fetch(`http://localhost:3000/api/status/${jobId}`);
          if (!statusRes.ok) return;

          const job = await statusRes.json();

          // Actualizar la barra de progreso
          updateProgress(
            `Fase: ${job.status} (${job.progressPercentage}%)`,
            job.progressPercentage
          );

          // Imprimir nuevos logs que el backend haya generado en tiempo real
          if (job.logs && job.logs.length > lastLogIndex) {
            for (let i = lastLogIndex; i < job.logs.length; i++) {
              const logLine = job.logs[i];
              if (logLine.includes('[SUCCESS]') || logLine.includes('éxito')) {
                addLog(logLine, 'success');
              } else if (logLine.includes('[WARNING]') || logLine.includes('Advertencia')) {
                addLog(logLine, 'system');
              } else if (logLine.includes('[ERROR]') || logLine.includes('[PYTHON ERR]')) {
                addLog(logLine, 'error');
              } else if (logLine.includes('COLMAP') || logLine.includes('tar')) {
                addLog(logLine, 'gpu');
              } else {
                addLog(logLine, 'default');
              }
            }
            lastLogIndex = job.logs.length;
          }

          // Si el trabajo falló
          if (job.status === 'FAILED') {
            clearInterval(pollInterval);
            addLog(`[FALLO EN PIPELINE] ${job.error || 'Error desconocido en el backend.'}`, 'error');
            progressContainer.style.display = 'none';
            btnStart.removeAttribute('disabled');
            btnBrowse.removeAttribute('disabled');
          }

          // Si el trabajo terminó con éxito
          if (job.status === 'COMPLETED') {
            clearInterval(pollInterval);
            addLog(`[BACKEND] Tarea ${jobId} completada con éxito.`, 'success');

            const modelUrl = job.modelUrl || `http://localhost:3000/models/vehicle-${jobId}-draco.glb`;
            activeModelUrl = modelUrl; // Guardar referencia de la malla IA
            setMode('ia'); // Establecer modo Malla IA
            addLog(`[VISOR 3D] Cargando modelo final desde: ${modelUrl}`, 'system');

            await renderer.loadModel(modelUrl, (loadingPercent) => {
              updateProgress('Renderizando malla final...', loadingPercent);
            });

            addLog(`[VISOR 3D] ¡Modelo final de la reconstrucción cargado en pantalla con éxito!`, 'success');
            loadHistory(); // Actualizar el historial lateral
            await sleep(800);
            progressContainer.style.display = 'none';
            btnStart.removeAttribute('disabled');
            btnBrowse.removeAttribute('disabled');
          }

        } catch (pollErr) {
          console.error('Error durante el polling:', pollErr);
        }
      }, 800);

    } catch (err) {
      addLog(`[FALLO AL CONECTAR AL SERVIDOR] ${err.message}`, 'error');
      addLog(`¿Iniciaste el backend? Abre una consola y ejecuta: pnpm --filter @vehicle-3d-scanner/backend start`, 'system');
      updateProgress('Error de conexión.', 100);
      progressContainer.style.display = 'none';
      btnStart.removeAttribute('disabled');
      btnBrowse.removeAttribute('disabled');
    }
  });

  function updateProgress(step, percent) {
    progressStep.innerText = step;
    progressPercent.innerText = `${percent}%`;
    progressBarFill.style.width = `${percent}%`;
  }

  function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  // --- AJUSTES Y PRESETS DE COLOR DE PINTURA ---
  colorDots.forEach(dot => {
    dot.addEventListener('click', (e) => {
      // Remover clase activo de todos los puntos
      colorDots.forEach(d => d.classList.remove('active'));
      // Agregar al punto seleccionado
      e.target.classList.add('active');

      const color = e.target.getAttribute('data-color');
      renderer.setCarColor(color);
      addLog(`Cambio de shader: Pintura del vehículo actualizada a ${e.target.title} (${color}).`, 'system');
    });
  });

  // --- ILUMINACIÓN Y ENTORNO ---
  toggleHdri.addEventListener('change', (e) => {
    renderer.setHdriEnvironment(e.target.checked);
    addLog(`Entorno HDRI de estudio ${e.target.checked ? 'activado (reflejos fotorrealistas)' : 'desactivado (iluminación básica)'}.`, 'system');
  });

  toggleShadows.addEventListener('change', (e) => {
    if (renderer.renderer) {
      renderer.renderer.shadowMap.enabled = e.target.checked;
      // Re-compilar materiales en la escena para aplicar cambio de sombras
      renderer.scene.traverse((node) => {
        if (node.isMesh) {
          node.castShadow = e.target.checked;
          if (node.material) node.material.needsUpdate = true;
        }
      });
      addLog(`Sombras de contacto en el suelo ${e.target.checked ? 'habilitadas (PCF Soft Shadow Map)' : 'deshabilitadas'}.`, 'system');
    }
  });

  // --- CONTROLES DE CÁMARA (PRESETS) ---
  camFront.addEventListener('click', () => {
    renderer.setCamera({ x: 0, y: 1.2, z: 8 }, { x: 0, y: 0.5, z: 0 });
    addLog('Cámara cambiada a vista FRONTAL.', 'system');
  });

  camSide.addEventListener('click', () => {
    renderer.setCamera({ x: 8, y: 0.9, z: 0 }, { x: 0, y: 0.5, z: 0 });
    addLog('Cámara cambiada a vista LATERAL.', 'system');
  });

  camTop.addEventListener('click', () => {
    renderer.setCamera({ x: 0.1, y: 9, z: 0.1 }, { x: 0, y: 0.5, z: 0 });
    addLog('Cámara cambiada a vista CENITAL.', 'system');
  });

  camIsometric.addEventListener('click', () => {
    renderer.setCamera({ x: 6, y: 2.5, z: 6 }, { x: 0, y: 0.5, z: 0 });
    addLog('Cámara cambiada a vista PERSPECTIVA ISOMÉTRICA.', 'system');
  });

  btnResetCam.addEventListener('click', () => {
    renderer.setCamera({ x: 6, y: 2.5, z: 8 }, { x: 0, y: 0.5, z: 0 });
    addLog('Cámara restablecida a valores iniciales.', 'system');
  });

  // --- MOSTRAR / OCULTAR INTERFAZ (VISTA DE RENDER COMPLETA) ---
  const uiWrapper = document.getElementById('ui-wrapper');
  const btnToggleUi = document.getElementById('btn-toggle-ui');
  const btnFloatingUiToggle = document.getElementById('btn-floating-ui-toggle');

  btnToggleUi.addEventListener('click', () => {
    uiWrapper.classList.add('ui-hidden');
    btnFloatingUiToggle.style.display = 'block';
    addLog('Interfaz oculta. Modo renderizado completo activado.', 'system');
  });

  btnFloatingUiToggle.addEventListener('click', () => {
    uiWrapper.classList.remove('ui-hidden');
    btnFloatingUiToggle.style.display = 'none';
    addLog('Interfaz restaurada.', 'system');
  });

  // --- CONTROLES DE MODO DE VISUALIZACIÓN 3D (MALLA IA / CAD) ---
  if (btnModeIa && btnModeHd) {
    btnModeIa.addEventListener('click', () => setMode('ia'));
    btnModeHd.addEventListener('click', () => setMode('hd'));
  }

  function setMode(mode) {
    if (!btnModeIa || !btnModeHd) return;

    // El modo Malla IA / CAD solo aplica al visor 3D
    if (viewerMode !== '3d') setViewerMode('3d');

    if (mode === 'ia') {
      btnModeIa.classList.add('btn-primary');
      btnModeIa.classList.remove('btn-outline');
      btnModeHd.classList.add('btn-outline');
      btnModeHd.classList.remove('btn-primary');

      if (activeModelUrl) {
        addLog(`[VISOR] Cargando malla IA reconstruida...`, 'system');
        renderer.loadModel(activeModelUrl).catch(err => {
          addLog(`Error al cargar malla IA: ${err.message || err}`, 'error');
        });
      } else {
        addLog('No hay ningún escaneo completado cargado. Sube una foto para generar tu malla.', 'system');
      }
    } else {
      btnModeHd.classList.add('btn-primary');
      btnModeHd.classList.remove('btn-outline');
      btnModeIa.classList.add('btn-outline');
      btnModeIa.classList.remove('btn-primary');

      const selectedVal = vehicleSelect.value;
      const modelKey = selectedVal === 'toyota-tacoma-2024' ? 'tacoma' : 'default';
      addLog(`[VISOR] Cargando modelo CAD de alta definición de referencia...`, 'system');
      renderer.loadModel(modelKey).catch(err => {
        addLog(`Error al cargar modelo HD CAD: ${err.message || err}`, 'error');
      });
    }
  }

  // Cargar historial de escaneos desde el servidor local
  async function loadHistory() {
    try {
      const res = await fetch('http://localhost:3000/api/jobs');
      const data = await res.json();
      const listContainer = document.getElementById('jobs-history-list');
      if (!listContainer) return;
      listContainer.innerHTML = '';

      if (data.jobs && data.jobs.length > 0) {
        // Filtrar y ordenar para tener los más recientes arriba
        data.jobs.reverse().forEach(job => {
          const btn = document.createElement('button');
          btn.className = 'btn btn-sm btn-outline';
          btn.style.width = '100%';
          btn.style.textAlign = 'left';
          btn.style.marginBottom = '6px';
          btn.style.fontSize = '11px';
          btn.style.display = 'flex';
          btn.style.justifyContent = 'space-between';
          btn.style.alignItems = 'center';
          btn.style.padding = '8px 10px';
          btn.style.background = 'rgba(255, 255, 255, 0.02)';

          let statusColor = '#eab308'; // amarillo (processing/pending)
          if (job.status === 'COMPLETED') statusColor = '#22c55e'; // verde
          if (job.status === 'FAILED') statusColor = '#ef4444'; // rojo

          const label = job.vehicleId === 'toyota-tacoma-2024' ? 'Tacoma 3D' : 'Deportivo 3D';
          btn.innerHTML = `
            <span style="font-weight: 500;">${label} (${job.jobId.replace('job-', '')})</span>
            <span style="width: 7px; height: 7px; border-radius: 50%; background-color: ${statusColor}; box-shadow: 0 0 6px ${statusColor};"></span>
          `;

          btn.addEventListener('click', async () => {
            if (job.status === 'COMPLETED' && job.modelUrl) {
              activeModelUrl = job.modelUrl; // Guardar referencia de la malla IA
              setMode('ia'); // Forzar visualización de Malla IA
              addLog(`[HISTORIAL] Restaurando escaneo ${job.jobId} desde: ${job.modelUrl}`, 'system');
              progressContainer.style.display = 'block';
              updateProgress('Cargando del historial...', 0);

              try {
                await renderer.loadModel(job.modelUrl, (loadingPercent) => {
                  updateProgress('Cargando del historial...', loadingPercent);
                });
                addLog(`[VISOR 3D] Escaneo ${job.jobId} cargado en pantalla con éxito.`, 'success');
              } catch (loadErr) {
                addLog(`Error al cargar modelo del historial: ${loadErr.message}`, 'error');
              } finally {
                progressContainer.style.display = 'none';
              }
            } else if (job.status === 'FAILED') {
              addLog(`[HISTORIAL] Tarea fallida (${job.jobId}). Detalle: ${job.error || 'N/A'}`, 'error');
            } else {
              addLog(`[HISTORIAL] Tarea en progreso (${job.jobId}). Estado: ${job.status}`, 'system');
            }
          });
          listContainer.appendChild(btn);
        });
      } else {
        listContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 11px; font-style: italic;">No hay escaneos recientes.</span>';
      }
    } catch (err) {
      // El backend local puede no estar corriendo; no es un error fatal.
      const listContainer = document.getElementById('jobs-history-list');
      if (listContainer) {
        listContainer.innerHTML = '<span style="color: var(--text-muted); font-size: 11px; font-style: italic;">Historial no disponible (backend local apagado).</span>';
      }
    }
  }

  // --- CONTROLES DE ZOOM Y CENTRADO FLOTANTES ---
  const btnZoomIn = document.getElementById('btn-zoom-in');
  const btnZoomOut = document.getElementById('btn-zoom-out');
  const btnCenterView = document.getElementById('btn-center-view');

  if (btnZoomIn) {
    btnZoomIn.addEventListener('click', () => {
      renderer.zoomIn(0.5);
      addLog('Acercando vista de cámara.', 'system');
    });
  }

  if (btnZoomOut) {
    btnZoomOut.addEventListener('click', () => {
      renderer.zoomOut(0.5);
      addLog('Alejando vista de cámara.', 'system');
    });
  }

  if (btnCenterView) {
    btnCenterView.addEventListener('click', () => {
      renderer.fitToView();
      addLog('Vista centrada y auto-ajustada al tamaño del vehículo (190 cm).', 'system');
    });
  }

  // --- DESCARGA DEL MODELO 3D (.glb) EN DISTINTAS CALIDADES ---
  const btnDlAlta = document.getElementById('btn-dl-alta');
  const btnDlMedia = document.getElementById('btn-dl-media');
  const btnDlBaja = document.getElementById('btn-dl-baja');

  function downloadModel(maxTextureSize, label) {
    if (viewerMode !== '3d') {
      addLog('[DESCARGA] La descarga .glb solo aplica al modo 3D (no al visor 360° de fotos).', 'system');
      return;
    }
    addLog(`[DESCARGA] Generando .glb en calidad ${label}...`, 'system');
    [btnDlAlta, btnDlMedia, btnDlBaja].forEach(b => b && b.setAttribute('disabled', 'true'));

    renderer.exportGLB(maxTextureSize).then((blob) => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `modelo-3d-${label.toLowerCase()}.glb`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      addLog(`[DESCARGA] ¡Listo! modelo-3d-${label.toLowerCase()}.glb (${(blob.size / 1024 / 1024).toFixed(2)} MB).`, 'success');
    }).catch((err) => {
      addLog(`[DESCARGA] Error: ${err.message}`, 'error');
    }).finally(() => {
      [btnDlAlta, btnDlMedia, btnDlBaja].forEach(b => b && b.removeAttribute('disabled'));
    });
  }

  if (btnDlAlta) btnDlAlta.addEventListener('click', () => downloadModel(0, 'Alta'));
  if (btnDlMedia) btnDlMedia.addEventListener('click', () => downloadModel(1024, 'Media'));
  if (btnDlBaja) btnDlBaja.addEventListener('click', () => downloadModel(512, 'Baja'));
});
