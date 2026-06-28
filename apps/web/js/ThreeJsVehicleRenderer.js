class ThreeJsVehicleRenderer {
  constructor() {
    this.scene = null;
    this.camera = null;
    this.renderer = null;
    this.controls = null;
    this.carGroup = null; // Contiene el modelo 3D del auto
    this.bodyMaterial = null; // Material de la pintura interactiva
    this.studioLights = [];
    this.floorShadow = null;
    this.currentLoadId = 0; // Evita condiciones de carrera en cargas asíncronas
  }

  /**
   * Inicializa la escena 3D de Three.js dentro del contenedor HTML dado.
   */
  initialize(containerId, options = {}) {
    const container = document.getElementById(containerId);
    if (!container) return Promise.reject(new Error('Contenedor no encontrado.'));

    // 1. Escena y color de fondo
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color(0x060814); // Azul oscuro casi negro premium
    this.scene.fog = new THREE.FogExp2(0x060814, 0.012);

    // 2. Cámara con lente de retrato (50mm focal para evitar distorsión de perspectiva)
    this.camera = new THREE.PerspectiveCamera(38, container.clientWidth / container.clientHeight, 0.1, 1000);
    this.camera.position.set(6, 2.5, 8);

    // 3. Renderizador WebGL2 con propiedades de fidelidad fotográfica
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setSize(container.clientWidth, container.clientHeight);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputEncoding = THREE.sRGBEncoding;
    this.renderer.shadowMap.enabled = options.enableShadows !== false;
    this.renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    container.appendChild(this.renderer.domElement);

    // 4. Controles Orbitales (Libres - zoom, pan y rotación en cualquier dirección)
    this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
    this.controls.enableDamping = true;      // Inercia suave
    this.controls.dampingFactor = 0.06;
    this.controls.enablePan = true;           // Mover modelo con clic derecho / 2 dedos
    this.controls.enableZoom = true;          // Zoom con scroll / pinch
    this.controls.minDistance = 0.3;          // Zoom máximo acercamiento (30cm)
    this.controls.maxDistance = 50;           // Zoom máximo alejamiento
    this.controls.maxPolarAngle = Math.PI;    // Rotación libre (puede ver desde abajo)
    this.controls.minPolarAngle = 0;          // Rotación libre (puede ver desde arriba)
    this.controls.autoRotate = true;          // Rotación lenta y cinematográfica
    this.controls.autoRotateSpeed = 0.5;
    this.controls.panSpeed = 1.2;
    this.controls.zoomSpeed = 1.5;
    // Detener autoRotate al interactuar
    this.renderer.domElement.addEventListener('pointerdown', () => { this.controls.autoRotate = false; });

    // 5. Configurar Iluminación de Estudio y Mapa de Entorno (HDRI)
    this.setupStudioLights();
    this.setHdriEnvironment();

    // 6. Suelo receptor de sombras de contacto
    this.setupFloorShadow();

    // 7. Evento de redimensionamiento de ventana
    window.addEventListener('resize', this.onWindowResize.bind(this));

    // 8. Iniciar ciclo de renderizado
    this.animate();

    return Promise.resolve();
  }

  /**
   * Configura las luces del estudio de fotografía.
   */
  setupStudioLights() {
    // Luz ambiental suave
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.15);
    this.scene.add(ambientLight);

    // Luz clave (Sun / Key Light)
    const keyLight = new THREE.DirectionalLight(0xffffff, 1.5);
    keyLight.position.set(5, 8, 5);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.bias = -0.0005;
    this.scene.add(keyLight);
    this.studioLights.push(keyLight);

    // Luz de relleno (Fill Light)
    const fillLight = new THREE.DirectionalLight(0x00f2fe, 0.8);
    fillLight.position.set(-5, 4, -5);
    this.scene.add(fillLight);
    this.studioLights.push(fillLight);

    // Luz superior suave de marquesina (Rim / Top Light)
    const topLight = new THREE.DirectionalLight(0x7c3aed, 1.2);
    topLight.position.set(0, 10, 0);
    this.scene.add(topLight);
    this.studioLights.push(topLight);
  }

  /**
   * Crea un mapa de entorno dinámico (HDRI sintético) basado en gradiente
   * para dar reflejos fotorrealistas a la carrocería brillante.
   */
  setHdriEnvironment(enabled = true) {
    if (!enabled) {
      this.scene.environment = null;
      return;
    }

    if (!this.renderer) return;

    // Crear un canvas para pintar un gradiente esférico reflectivo
    const canvas = document.createElement('canvas');
    canvas.width = 512;
    canvas.height = 512;
    const ctx = canvas.getContext('2d');
    
    // Crear un gradiente futurista neon
    const grad = ctx.createRadialGradient(256, 256, 10, 256, 256, 256);
    grad.addColorStop(0, '#00f2fe');
    grad.addColorStop(0.5, '#7c3aed');
    grad.addColorStop(1.0, '#060814');
    
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 512, 512);
    
    const tempTexture = new THREE.CanvasTexture(canvas);
    const pmremGenerator = new THREE.PMREMGenerator(this.renderer);
    pmremGenerator.compileEquirectangularShader();
    
    const envMap = pmremGenerator.fromEquirectangular(tempTexture).texture;
    this.scene.environment = envMap;
    
    tempTexture.dispose();
    pmremGenerator.dispose();
  }

  /**
   * Configura la rejilla del suelo y el plano receptor de sombras suaves.
   */
  setupFloorShadow() {
    // Plano del suelo receptor de sombras
    const floorGeo = new THREE.PlaneGeometry(30, 30);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.4 });
    
    this.floorShadow = new THREE.Mesh(floorGeo, floorMat);
    this.floorShadow.rotation.x = -Math.PI / 2;
    this.floorShadow.position.y = 0;
    this.floorShadow.receiveShadow = true;
    this.scene.add(this.floorShadow);

    // Rejilla de fondo para dar escala espacial
    const gridHelper = new THREE.GridHelper(30, 30, 0x00f2fe, 0x1e293b);
    gridHelper.position.y = 0.005;
    gridHelper.material.opacity = 0.12;
    gridHelper.material.transparent = true;
    this.scene.add(gridHelper);
  }

  /**
   * Carga el modelo 3D utilizando GLTFLoader con compresión Draco u OBJLoader.
   */
  async loadModel(modelUrl, onProgress) {
    this.currentLoadId++;
    const loadId = this.currentLoadId;

    // Si es el modelo por defecto o una URL simulada del almacenamiento interno
    let targetUrl = modelUrl;
    if (
      modelUrl === 'default' || 
      modelUrl === 'initial' || 
      !modelUrl.startsWith('http') ||
      modelUrl.includes('3dvehiclescanner.internal')
    ) {
      if (modelUrl.includes('tacoma')) {
        // Carga una camioneta utilitaria/comercial para simular la Tacoma
        targetUrl = 'https://cdn.jsdelivr.net/gh/KhronosGroup/glTF-Sample-Models@master/2.0/CesiumMilkTruck/glTF-Binary/CesiumMilkTruck.glb';
      } else {
        // Carga el coche deportivo Ferrari
        targetUrl = 'https://cdn.jsdelivr.net/gh/mrdoob/three.js@dev/examples/models/gltf/ferrari.glb';
      }
    }

    // Si la URL contiene .obj, cargarlo usando OBJLoader con alineación y auto-escalado
    if (targetUrl.includes('.obj')) {
      const loader = new THREE.OBJLoader();

      return new Promise((resolve, reject) => {
        loader.load(
          targetUrl,
          (obj) => {
            // Descartar si hay una carga más nueva
            if (loadId !== this.currentLoadId) {
              resolve(null);
              return;
            }

            // Eliminar carro anterior de forma segura justo antes de renderizar
            if (this.carGroup) {
              this.scene.remove(this.carGroup);
              this.carGroup = null;
            }
            // Rotar el modelo 90 grados en el eje X para corregir el desfase de ejes (Z-up de IA a Y-up de Three.js)
            obj.rotation.x = -Math.PI / 2;
            
            // Crear el wrapper antes de calcular el volumen de colisión
            const wrapper = new THREE.Group();
            wrapper.add(obj);
            
            // Calcular caja de colisión para centrar y apoyar
            const box = new THREE.Box3().setFromObject(wrapper);
            const center = new THREE.Vector3();
            box.getCenter(center);
            const size = new THREE.Vector3();
            box.getSize(size);
            
            // Desplazar el objeto hijo dentro del wrapper para centrarlo geométricamente
            obj.position.x = -center.x;
            obj.position.y = -box.min.y; // Apoyado sobre el suelo en Y=0
            obj.position.z = -center.z;
            
            // Auto-escalar para que el modelo mida 190cm (1.9 unidades) en su dimensión mayor
            const maxDim = Math.max(size.x, size.y, size.z);
            const targetSize = 1.9; // 190cm en unidades Three.js (1 unidad = 1 metro)
            
            // Mitigación de Outliers: si la geometría tiene ruido o vértices parásitos
            let scaleFactor = targetSize / maxDim;
            if (maxDim > 10.0 || maxDim < 0.001) {
              console.warn("Outliers o ruido detectados en el volumen de la malla. Usando escala por defecto.");
              scaleFactor = targetSize / 2.0;
            }
            wrapper.scale.set(scaleFactor, scaleFactor, scaleFactor);
            this._modelRealSize = targetSize; // Guardar referencia de escala

            this.carGroup = wrapper;

            // Configurar sombras y aplicar un material de "Modo Arcilla/Malla" suave.
            // Usamos sombreado SUAVE (flatShading: false) y recalculamos normales para
            // que la malla de IA no se vea facetada/tosca; eso era lo que la afeaba.
            const clayMaterial = new THREE.MeshStandardMaterial({
              color: 0x9aa7b8,       // Gris arcilla azulado claro
              roughness: 0.75,       // Mate para disipar reflejos
              metalness: 0.05,       // Casi no reflectivo
              flatShading: false     // Sombreado suave (sin facetas duras)
            });

            this.carGroup.traverse((child) => {
              if (child.isMesh) {
                child.castShadow = true;
                child.receiveShadow = true;

                // Recalcular normales suaves para alisar la superficie reconstruida
                if (child.geometry) {
                  child.geometry.computeVertexNormals();
                }

                // Si el modelo contiene colores de vértices válidos, respetarlos
                if (child.geometry && child.geometry.attributes.color) {
                  child.material = new THREE.MeshStandardMaterial({
                    vertexColors: true,
                    roughness: 0.75,
                    metalness: 0.05,
                    flatShading: false
                  });
                } else {
                  child.material = clayMaterial;
                }
              }
            });

            this.scene.add(this.carGroup);
            resolve(this.carGroup);
          },
          (xhr) => {
            if (xhr.total > 0 && onProgress) {
              const percent = Math.round((xhr.loaded / xhr.total) * 100);
              onProgress(percent);
            } else {
              if (onProgress) onProgress(50);
            }
          },
          (err) => {
            console.error("Error al cargar modelo OBJ de Replicate:", err);
            reject(err);
          }
        );
      });
    }

    // 2. Configurar el material de pintura física de carrocería (Car Paint Shader)
    this.bodyMaterial = new THREE.MeshPhysicalMaterial({
      color: 0x0f1c2c,       // Color base inicial (Azul noche)
      metalness: 0.9,        // Altamente metálico
      roughness: 0.15,       // Pulido brillante
      clearcoat: 1.0,        // Capa de laca transparente
      clearcoatRoughness: 0.05,
      reflectivity: 1.0
    });

    // 3. Configurar cargadores con decodificador Draco
    const dracoLoader = new THREE.DRACOLoader();
    dracoLoader.setDecoderPath('https://www.gstatic.com/draco/versioned/decoders/1.4.3/');

    const loader = new THREE.GLTFLoader();
    loader.setDRACOLoader(dracoLoader);

    // 4. Cargar el archivo GLB
    return new Promise((resolve, reject) => {
      loader.load(
        targetUrl,
        (gltf) => {
          // Descartar si hay una carga más nueva en progreso
          if (loadId !== this.currentLoadId) {
            dracoLoader.dispose();
            resolve(null);
            return;
          }

          // Eliminar carro anterior de forma segura justo antes de renderizar
          if (this.carGroup) {
            this.scene.remove(this.carGroup);
            this.carGroup = null;
          }

          this.carGroup = gltf.scene;

          // Ajustar escala y posición según el tipo de vehículo
          if (targetUrl.includes('CesiumMilkTruck')) {
            this.carGroup.scale.set(1.1, 1.1, 1.1);
            this.carGroup.position.set(0, 0, 0);
          } else {
            this.carGroup.scale.set(1, 1, 1);
            this.carGroup.position.set(0, -0.05, 0); // Ajustar para que las llantas queden sobre el suelo (Ferrari)
          }

          // Configurar sombras y aplicar pintura metálica en la carrocería
          this.carGroup.traverse((child) => {
            if (child.isMesh) {
              child.castShadow = true;
              child.receiveShadow = true;

              // Si es parte de la carrocería, le asignamos el material interactivo
              if (
                child.name.includes('body') || 
                child.name.includes('paint') || 
                child.name.includes('exterior')
              ) {
                child.material = this.bodyMaterial;
              }
            }
          });

          this.scene.add(this.carGroup);
          dracoLoader.dispose(); // Liberar cargador
          resolve(this.carGroup);
        },
        (xhr) => {
          if (xhr.total > 0 && onProgress) {
            const percent = Math.round((xhr.loaded / xhr.total) * 100);
            onProgress(percent);
          }
        },
        (err) => {
          console.error(err);
          reject(err);
        }
      );
    });
  }

  /**
   * Cambia el color de la pintura de la carrocería del carro en tiempo real.
   */
  setCarColor(colorHex) {
    if (this.bodyMaterial) {
      this.bodyMaterial.color.setHex(parseInt(colorHex.replace('#', '0x')));
    }
  }

  /**
   * Configura los parámetros de posición y objetivo de la cámara 3D orbital.
   */
  setCamera(position, target) {
    if (this.camera && this.controls) {
      // Transición suave usando la cámara
      this.camera.position.set(position.x, position.y, position.z);
      this.controls.target.set(target.x, target.y, target.z);
      this.controls.update();
    }
  }

  /**
   * Controlador para redimensionar el lienzo WebGL al cambiar el tamaño de pantalla.
   */
  onWindowResize() {
    const container = this.renderer.domElement.parentElement;
    this.camera.aspect = container.clientWidth / container.clientHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(container.clientWidth, container.clientHeight);
  }

  /**
   * Ciclo de renderizado de animación continua.
   */
  animate() {
    requestAnimationFrame(this.animate.bind(this));
    
    // Actualizar controles orbitales en cada frame
    if (this.controls) {
      this.controls.update();
    }
    
    // Renderizar la escena
    if (this.renderer && this.scene && this.camera) {
      this.renderer.render(this.scene, this.camera);
    }
  }

  /** Zoom programático: acercar (+) o alejar (-) */
  zoomIn(factor = 0.8) {
    if (this.camera) {
      const dir = new THREE.Vector3();
      this.camera.getWorldDirection(dir);
      this.camera.position.addScaledVector(dir, factor);
    }
  }

  zoomOut(factor = 0.8) {
    this.zoomIn(-factor);
  }

  /** Reiniciar cámara a la posición original */
  resetCamera() {
    if (this.camera && this.controls) {
      this.camera.position.set(3, 1.5, 4);
      this.controls.target.set(0, 0.5, 0);
      this.controls.autoRotate = true;
      this.controls.update();
    }
  }

  /** Encuadrar el modelo completo en la vista */
  fitToView() {
    if (!this.carGroup || !this.camera || !this.controls) return;
    const box = new THREE.Box3().setFromObject(this.carGroup);
    const center = new THREE.Vector3();
    const size = new THREE.Vector3();
    box.getCenter(center);
    box.getSize(size);
    const maxDim = Math.max(size.x, size.y, size.z);
    const fov = this.camera.fov * (Math.PI / 180);
    let dist = maxDim / (2 * Math.tan(fov / 2));
    dist *= 1.6; // Margen visual
    this.camera.position.set(center.x + dist * 0.6, center.y + dist * 0.4, center.z + dist * 0.8);
    this.controls.target.copy(center);
    this.controls.update();
  }

  /**
   * Reduce una textura a un tamaño máximo (px) usando un canvas.
   * Devuelve una nueva CanvasTexture; NO modifica la original.
   */
  _downscaleTexture(tex, maxSize) {
    const img = tex.image;
    const iw = img.width, ih = img.height;
    const scale = Math.min(1, maxSize / Math.max(iw, ih));
    const w = Math.max(1, Math.round(iw * scale));
    const h = Math.max(1, Math.round(ih * scale));
    const canvas = document.createElement('canvas');
    canvas.width = w; canvas.height = h;
    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
    const newTex = new THREE.CanvasTexture(canvas);
    if (tex.flipY !== undefined) newTex.flipY = tex.flipY;
    newTex.encoding = tex.encoding;
    newTex.wrapS = tex.wrapS;
    newTex.wrapT = tex.wrapT;
    newTex.needsUpdate = true;
    return newTex;
  }

  /**
   * Exporta el modelo actualmente cargado a un Blob .glb (binario).
   * @param {number} maxTextureSize - 0 = textura original (Alta). >0 = reduce
   *        las texturas a ese tamaño máximo (p.ej. 1024 o 512) para que pese menos.
   * @returns {Promise<Blob>}
   */
  exportGLB(maxTextureSize = 0) {
    return new Promise((resolve, reject) => {
      if (!this.carGroup) {
        reject(new Error('No hay ningún modelo cargado para descargar.'));
        return;
      }
      if (typeof THREE.GLTFExporter === 'undefined') {
        reject(new Error('GLTFExporter no se cargó (revisa tu conexión al CDN).'));
        return;
      }

      // Intercambiar temporalmente las texturas por versiones reducidas
      const swaps = []; // { mat, key, original }
      if (maxTextureSize && maxTextureSize > 0) {
        try {
          const TEXTURE_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'emissiveMap', 'aoMap'];
          this.carGroup.traverse((child) => {
            if (child.isMesh && child.material) {
              const mats = Array.isArray(child.material) ? child.material : [child.material];
              mats.forEach((mat) => {
                TEXTURE_KEYS.forEach((key) => {
                  const tex = mat[key];
                  if (tex && tex.image && tex.image.width &&
                      Math.max(tex.image.width, tex.image.height) > maxTextureSize) {
                    try {
                      const small = this._downscaleTexture(tex, maxTextureSize);
                      swaps.push({ mat, key, original: tex });
                      mat[key] = small;
                    } catch (e) { /* si falla, dejar la textura original */ }
                  }
                });
              });
            }
          });
        } catch (e) { /* continuar sin reducir texturas */ }
      }

      const restore = () => swaps.forEach((s) => { s.mat[s.key] = s.original; });

      try {
        const exporter = new THREE.GLTFExporter();
        exporter.parse(this.carGroup, (result) => {
          restore();
          try {
            const blob = new Blob([result], { type: 'model/gltf-binary' });
            resolve(blob);
          } catch (e) {
            reject(e);
          }
        }, { binary: true });
      } catch (e) {
        restore();
        reject(e);
      }
    });
  }
}
