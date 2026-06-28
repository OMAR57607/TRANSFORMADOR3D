# Lista de Tareas - Escáner 3D de Vehículos con Replicate IA

- [x] Crear configuración de monorepo pnpm, Core, Backend y Móvil
- [x] Implementar contratos y lógica de caso de uso del dominio
- [x] Implementar visor WebGL con Three.js en el Frontend
- [/] Integrar pipeline de IA 3D con Replicate en la nube
    - [ ] Configurar carga y lectura del token de API de Replicate en `server.py`
    - [ ] Modificar `server.py` para recibir imágenes JPG/PNG individuales
    - [ ] Implementar conector HTTP REST para crear predicciones en Replicate (`Vaibhavs10/InstantMesh` o `tencent/hunyuan3d-2`)
    - [ ] Implementar bucle de monitoreo del estado del job en Replicate con streaming de logs
    - [ ] Descargar el modelo GLTF/GLB generado de Replicate al almacenamiento local
    - [ ] Actualizar la zona de subida en `index.html` y `app.js` para guiar al usuario a subir una foto individual
    - [ ] Validar el flujo completo cargando una foto real
