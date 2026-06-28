/**
 * Opciones para configurar la inicialización del motor de renderizado 3D.
 */
export interface RendererOptions {
  /**
   * Habilita o deshabilita las sombras en la escena.
   */
  enableShadows?: boolean;

  /**
   * URL opcional de un entorno HDRI para iluminación y reflejos realistas sobre la pintura.
   */
  hdriEnvironmentUrl?: string;

  /**
   * Intensidad de la luz ambiental.
   */
  ambientLightIntensity?: number;
}

/**
 * Coordenadas 3D básicas para posicionamiento.
 */
export interface Vector3D {
  x: number;
  y: number;
  z: number;
}

/**
 * Contrato de dominio para el motor de renderizado 3D del vehículo.
 * 
 * APLICA EL PRINCIPIO DE SEGREGACIÓN DE INTERFACES (ISP):
 * La interfaz es específica para las operaciones de visualización, permitiendo
 * que el visor 3D se limite a la carga y manipulación espacial del objeto
 * sin mezclar responsabilidades de red o procesamiento.
 * 
 * APLICA EL PRINCIPIO DE INVERSIÓN de DEPENDENCIAS (DIP):
 * Evita el acoplamiento directo de la aplicación con bibliotecas como Three.js o Babylon.js.
 * Si se decide migrar a WebGPU u otro motor, los componentes de la interfaz de usuario
 * seguirán comunicándose a través de este contrato.
 */
export interface IVehicle3DRenderer {
  /**
   * Inicializa la escena 3D en el lienzo (canvas) provisto.
   * @param containerId El ID del elemento contenedor en el DOM (o su equivalente en móvil).
   * @param options Opciones de inicialización de la escena.
   */
  initialize(containerId: string, options?: RendererOptions): Promise<void>;

  /**
   * Carga el modelo 3D del vehículo (por ejemplo, en formato .glb/.gltf comprimido).
   * @param modelUrl URL remota o ruta local del modelo 3D.
   * @param onProgress Callback para seguir el porcentaje de carga del archivo.
   */
  loadModel(modelUrl: string, onProgress?: (progress: number) => void): Promise<void>;

  /**
   * Establece un entorno HDRI para reflejos de alta fidelidad sobre la carrocería del vehículo.
   * @param hdriUrl URL del archivo HDR.
   */
  setHdriEnvironment(hdriUrl: string): Promise<void>;

  /**
   * Cambia la posición y orientación de la cámara para realizar tomas dinámicas.
   * @param position Coordenadas de posición de la cámara.
   * @param lookAt Coordenadas del punto hacia el cual mira la cámara.
   */
  setCamera(position: Vector3D, lookAt: Vector3D): void;

  /**
   * Libera los recursos de GPU, memoria y detiene el ciclo de animación del renderizador.
   */
  destroy(): void;
}
