# Escáner y Renderizado 3D de Vehículos - Estructura Base

Este proyecto es una plataforma de escaneo y renderizado 3D de vehículos que implementa **Clean Architecture** (Arquitectura Limpia) y los principios **SOLID**.

## Arquitectura del Proyecto

El monorepo está organizado en varias carpetas para mantener un desacoplamiento estricto:

- **`packages/core`**: Contiene la lógica del dominio (reglas de negocio centrales), casos de uso e interfaces abstractas. No tiene dependencias de infraestructura ni de frameworks de presentación.
- **`apps/backend`**: Servicio backend encargado de la cola de procesamiento 3D.
- **`apps/mobile`**: Aplicación móvil para la captura guiada de fotos y videos.

### Capas de Clean Architecture en `packages/core`

1. **Dominio (`domain/`)**: Contratos/Interfaces como `IScanningProcessor`, `IFileUploader` y `IVehicle3DRenderer`. Define *qué* hace el sistema.
2. **Aplicación (`application/`)**: El caso de uso `SubmitVehicleScan`. Coordina el flujo de negocio llamando a los contratos del dominio.
3. **Infraestructura (`infrastructure/`)**: Implementaciones reales y mocks como `MockFileUploader` (con lógica de retroceso exponencial) y `MockScanningProcessor`. Define *cómo* se hace.

---

## Cómo Iniciar e Instalar Dependencias

Desde la raíz del proyecto, puedes instalar las dependencias y ejecutar la prueba:

```bash
# Instalar dependencias del monorepo
pnpm install

# Ejecutar la simulación del caso de uso de core
pnpm core:start
```
