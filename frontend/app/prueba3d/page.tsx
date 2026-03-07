'use client';

import { useState } from 'react';
import { generateDepthMap } from '@/lib/depthAI';
import Parallax3D from '@/components/Parallax3D';

export default function Prueba3DPage() {
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [depthUrl, setDepthUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('');

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setDepthUrl(null);
    setLoading(true);
    
    const objectUrl = URL.createObjectURL(file);
    setImageUrl(objectUrl);

    try {
      setStatus('Iniciando IA (la primera descarga del modelo toma unos segundos)...');
      
      const generatedDepthUrl = await generateDepthMap(objectUrl, (info: any) => {
         if (info.status === 'progress') {
            setProgress(Math.round(info.progress));
            setStatus(`Descargando y procesando... ${Math.round(info.progress)}%`);
         }
      });
      
      setDepthUrl(generatedDepthUrl);
      setStatus('');
    } catch (error) {
      console.error(error);
      setStatus('Hubo un error procesando la imagen.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white p-8 flex flex-col items-center justify-center font-sans">
      <h1 className="text-3xl font-bold mb-6 text-center">Magia 3D de iPhone en la Web</h1>
      
      <div className="mb-6 w-full max-w-md">
        <label className="block w-full text-center py-3 px-4 rounded-xl border-2 border-dashed border-gray-600 hover:border-blue-500 hover:bg-gray-900 transition cursor-pointer">
          <span>Seleccionar una Foto</span>
          <input 
            type="file" 
            accept="image/*" 
            onChange={handleImageUpload}
            className="hidden"
          />
        </label>
      </div>

      {loading && (
         <div className="mb-6 w-full max-w-md text-center text-blue-400">
           <p className="mb-2 text-sm">{status}</p>
           {progress > 0 && progress < 100 && (
             <div className="w-full bg-gray-800 rounded-full h-2">
               <div className="bg-blue-500 h-2 rounded-full transition-all duration-300" style={{ width: `${progress}%` }}></div>
             </div>
           )}
         </div>
      )}

      {/* Contenedor de la foto */}
      <div className="w-full max-w-2xl h-[500px] border border-gray-800 rounded-2xl overflow-hidden bg-black flex items-center justify-center shadow-2xl">
        {imageUrl && depthUrl ? (
          <Parallax3D imageUrl={imageUrl} depthUrl={depthUrl} />
        ) : imageUrl ? (
          <img src={imageUrl} alt="Subida" className="w-full h-full object-cover opacity-50" />
        ) : (
          <p className="text-gray-600 text-sm">El resultado se mostrará aquí</p>
        )}
      </div>
    </div>
  );
}