import { pipeline, env } from '@xenova/transformers';

// Le decimos a la librería que no busque modelos locales y los descargue de HuggingFace
env.allowLocalModels = false;

/** Convierte data URL (base64) de la IA a File para subir a Supabase */
export function dataURLtoFile(dataurl: string, filename: string): File {
  const arr = dataurl.split(',');
  const mimeMatch = arr[0].match(/:(.*?);/);
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg';
  const bstr = atob(arr[1] ?? '');
  const n = bstr.length;
  const u8arr = new Uint8Array(n);
  for (let i = 0; i < n; i++) u8arr[i] = bstr.charCodeAt(i);
  return new File([u8arr], filename, { type: mime });
}

class DepthPipeline {
  static task = 'depth-estimation' as const;
  static model = 'Xenova/depth-anything-small-hf';
  static instance: any = null;

  static async getInstance(progress_callback?: (info: any) => void) {
    if (this.instance === null) {
      this.instance = pipeline(this.task, this.model, { progress_callback });
    }
    return this.instance;
  }
}

export async function generateDepthMap(imageUrl: string, onProgress?: (info: any) => void): Promise<string> {
  try {
    const estimator = await DepthPipeline.getInstance(onProgress);
    
    // Ejecutamos la IA sobre la imagen original
    const output = await estimator(imageUrl);
    const rawImage = output.depth;
    
    // La IA nos devuelve un arreglo de píxeles en 1 solo canal (escala de grises)
    // Lo convertimos a una imagen normal de 4 canales (RGBA) para poder usarla
    const canvas = document.createElement('canvas');
    canvas.width = rawImage.width;
    canvas.height = rawImage.height;
    const ctx = canvas.getContext('2d');
    
    if (!ctx) throw new Error("No se pudo iniciar el canvas 2D");

    const imgData = new ImageData(rawImage.width, rawImage.height);
    for (let i = 0; i < rawImage.data.length; i++) {
      const val = rawImage.data[i];
      imgData.data[i * 4] = val;       // Rojo
      imgData.data[i * 4 + 1] = val;   // Verde
      imgData.data[i * 4 + 2] = val;   // Azul
      imgData.data[i * 4 + 3] = 255;   // Opacidad
    }
    
    ctx.putImageData(imgData, 0, 0);
    
    // Devolvemos la imagen como una URL base64 lista para la tarjeta gráfica
    return canvas.toDataURL('image/jpeg');
  } catch (error) {
    console.error("Error al generar mapa de profundidad:", error);
    throw error;
  }
}