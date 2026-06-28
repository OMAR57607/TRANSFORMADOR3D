/**
 * Visor 360° (2D) - Spinner de fotos interactivo.
 *
 * No usa IA ni backend: toma una secuencia de fotos reales del vehículo
 * y deja que el usuario "gire" el coche arrastrando con el ratón o el dedo.
 * Como son fotos reales, el resultado siempre se ve perfecto (a diferencia
 * de una malla 3D generada por IA, que puede salir tosca).
 */
class Spinner360Viewer {
  constructor(containerId) {
    this.container = document.getElementById(containerId);
    if (!this.container) throw new Error('Contenedor del visor 360 no encontrado.');

    this.canvas = document.createElement('canvas');
    this.canvas.style.width = '100%';
    this.canvas.style.height = '100%';
    this.canvas.style.display = 'block';
    this.canvas.style.cursor = 'grab';
    this.canvas.style.touchAction = 'pan-y';
    this.ctx = this.canvas.getContext('2d');
    this.container.appendChild(this.canvas);

    this.frames = [];          // Array de objetos Image ya cargados
    this.current = 0;          // Índice del fotograma actual
    this.isDragging = false;
    this.lastX = 0;
    this.dragAccum = 0;        // Acumulador de píxeles arrastrados
    this.dragSensitivity = 8;  // Píxeles de arrastre por cambio de fotograma
    this.autoRotate = true;
    this.autoTimer = null;

    this._bindEvents();
    window.addEventListener('resize', () => this._resize());
    this._resize();
  }

  /** Carga la secuencia de fotogramas a partir de una lista de URLs (o blob URLs). */
  async loadFrames(sources, onProgress) {
    this.stopAuto();
    const imgs = [];
    for (let i = 0; i < sources.length; i++) {
      try {
        imgs.push(await this._loadImage(sources[i]));
      } catch (e) {
        // Saltar fotogramas que no carguen, sin romper el resto
        console.warn('No se pudo cargar el fotograma', sources[i]);
      }
      if (onProgress) onProgress(Math.round(((i + 1) / sources.length) * 100));
    }
    this.frames = imgs;
    this.current = 0;
    this._resize();
    this.draw();
    if (this.frames.length > 1) this.startAuto();
    return this.frames.length;
  }

  _loadImage(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = reject;
      img.src = src;
    });
  }

  startAuto() {
    this.stopAuto();
    this.autoRotate = true;
    this.autoTimer = setInterval(() => {
      if (this.autoRotate && this.frames.length > 1) {
        this.current = (this.current + 1) % this.frames.length;
        this.draw();
      }
    }, 100);
  }

  stopAuto() {
    if (this.autoTimer) {
      clearInterval(this.autoTimer);
      this.autoTimer = null;
    }
  }

  _bindEvents() {
    const onDown = (x) => {
      this.isDragging = true;
      this.autoRotate = false;
      this.lastX = x;
      this.dragAccum = 0;
      this.canvas.style.cursor = 'grabbing';
    };
    const onMove = (x) => {
      if (!this.isDragging || this.frames.length === 0) return;
      this.dragAccum += (x - this.lastX);
      while (Math.abs(this.dragAccum) >= this.dragSensitivity) {
        if (this.dragAccum > 0) {
          this.current = (this.current - 1 + this.frames.length) % this.frames.length;
          this.dragAccum -= this.dragSensitivity;
        } else {
          this.current = (this.current + 1) % this.frames.length;
          this.dragAccum += this.dragSensitivity;
        }
        this.draw();
      }
      this.lastX = x;
    };
    const onUp = () => {
      this.isDragging = false;
      this.canvas.style.cursor = 'grab';
    };

    this.canvas.addEventListener('mousedown', (e) => onDown(e.clientX));
    window.addEventListener('mousemove', (e) => onMove(e.clientX));
    window.addEventListener('mouseup', onUp);
    this.canvas.addEventListener('touchstart', (e) => onDown(e.touches[0].clientX), { passive: true });
    this.canvas.addEventListener('touchmove', (e) => onMove(e.touches[0].clientX), { passive: true });
    this.canvas.addEventListener('touchend', onUp);
  }

  _resize() {
    const rect = this.container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    this.canvas.width = Math.max(1, Math.floor((rect.width || window.innerWidth) * dpr));
    this.canvas.height = Math.max(1, Math.floor((rect.height || window.innerHeight) * dpr));
    this.draw();
  }

  draw() {
    const ctx = this.ctx;
    if (!ctx) return;
    const cw = this.canvas.width;
    const ch = this.canvas.height;

    ctx.fillStyle = '#060814';
    ctx.fillRect(0, 0, cw, ch);

    if (this.frames.length === 0) return;
    const img = this.frames[this.current];
    if (!img) return;

    // Encajar la imagen manteniendo proporción (modo "contain")
    const ir = img.width / img.height;
    const cr = cw / ch;
    let dw, dh;
    if (ir > cr) {
      dw = cw * 0.92;
      dh = dw / ir;
    } else {
      dh = ch * 0.92;
      dw = dh * ir;
    }
    const dx = (cw - dw) / 2;
    const dy = (ch - dh) / 2;
    ctx.drawImage(img, dx, dy, dw, dh);
  }

  clear() {
    this.stopAuto();
    this.frames = [];
    this.current = 0;
    this.draw();
  }
}

// Exponer globalmente para que app.js la instancie
window.Spinner360Viewer = Spinner360Viewer;
