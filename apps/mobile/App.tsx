import React, { useState } from 'react';
import { StyleSheet, Text, View, TouchableOpacity, ActivityIndicator, StatusBar } from 'react-native';

/**
 * Pantalla Principal de Captura Móvil (React Native / TypeScript).
 * 
 * APLICA LOS PRINCIPIOS DE CLEAN ARCHITECTURE (PRESENTACIÓN MÓVIL):
 * Este componente es el detalle de entrega de la aplicación móvil (Capa de Presentación).
 * Se encarga exclusivamente de guiar visualmente al usuario y de invocar al caso de uso
 * central SubmitVehicleScan inyectado con sus correspondientes clientes de red móviles.
 */
export default function App() {
  const [status, setStatus] = useState<string>('Listo para iniciar la captura');
  const [progress, setProgress] = useState<number>(0);
  const [isRecording, setIsRecording] = useState<boolean>(false);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  /**
   * Simula el proceso de guiado de captura de video 360 alrededor del auto.
   */
  const startGuidedCapture = async () => {
    setIsRecording(true);
    setProgress(0);
    setStatus('Grabación guiada activa. Camine despacio a velocidad constante alrededor del vehículo...');

    // Simular el temporizador de guiado de giroscopio y cámara
    for (let p = 0; p <= 100; p += 20) {
      await sleep(600);
      setProgress(p);
    }

    setIsRecording(false);
    setIsUploading(true);
    setProgress(0);
    setStatus('Procesando fragmentos locales y subiendo archivo...');

    // Simular llamada al caso de uso del monorepo Core SubmitVehicleScan
    // Inyectándole los transportes móviles nativos para carga resiliente.
    await simulateSubmitScanUseCase();
  };

  /**
   * Simulación del comportamiento del caso de uso inyectado con progreso.
   */
  const simulateSubmitScanUseCase = async () => {
    // 1. Simulación de reintento móvil por red inestable (inyectado a través del Core)
    setStatus('Subiendo captura raw (Intento 1/3)...');
    await sleep(800);
    setStatus('[Red Inestable] Conexión 4G interrumpida. Aplicando Backoff Exponencial en 1.0s...');
    await sleep(1000);
    setStatus('Reintentando subida (Intento 2/3)... Conexión restablecida.');

    // 2. Progreso de subida
    for (let p = 10; p <= 100; p += 15) {
      const currentPercent = Math.min(p, 100);
      setProgress(currentPercent);
      await sleep(150);
    }

    // 3. Cola iniciada en Backend
    setStatus('Registrando encolamiento en el Backend de reconstrucción...');
    setProgress(0);
    await sleep(600);

    setStatus('¡Escaneo enviado! Tu reconstrucción 3DGS con compresión Draco está en cola.');
    setIsUploading(false);
  };

  const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.header}>
        <Text style={styles.title}>Antigravity <Text style={styles.accent}>3D Mobile</Text></Text>
        <Text style={styles.subtitle}>Captura guiada de vehículos en alta definición</Text>
      </View>

      <View style={styles.previewBox}>
        <Text style={styles.statusText}>{status}</Text>
        
        {(isRecording || isUploading) && (
          <View style={styles.progressArea}>
            <ActivityIndicator size="large" color="#00f2fe" />
            <Text style={styles.percentText}>{progress}%</Text>
          </View>
        )}
      </View>

      <TouchableOpacity
        style={[styles.button, (isRecording || isUploading) && styles.buttonDisabled]}
        onPress={startGuidedCapture}
        disabled={isRecording || isUploading}
      >
        <Text style={styles.buttonText}>
          {isRecording ? 'Grabando 360°...' : isUploading ? 'Subiendo...' : 'Iniciar Captura 360°'}
        </Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#030712',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 60,
    paddingHorizontal: 24,
  },
  header: {
    alignItems: 'center',
  },
  title: {
    fontSize: 26,
    fontWeight: '700',
    color: '#f8fafc',
    letterSpacing: 0.5,
  },
  accent: {
    fontWeight: '300',
    color: '#00f2fe',
  },
  subtitle: {
    fontSize: 13,
    color: '#94a3b8',
    marginTop: 8,
    textAlign: 'center',
  },
  previewBox: {
    width: '100%',
    flex: 0.7,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    borderRadius: 20,
    padding: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statusText: {
    fontSize: 16,
    color: '#f8fafc',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 20,
  },
  progressArea: {
    alignItems: 'center',
    gap: 12,
  },
  percentText: {
    fontSize: 22,
    fontWeight: '700',
    color: '#00f2fe',
  },
  button: {
    width: '100%',
    backgroundColor: '#7c3aed',
    paddingVertical: 18,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: '#7c3aed',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.35,
    shadowRadius: 10,
    elevation: 8,
  },
  buttonDisabled: {
    backgroundColor: '#1f2937',
    shadowOpacity: 0,
    elevation: 0,
  },
  buttonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#030712',
  },
});
