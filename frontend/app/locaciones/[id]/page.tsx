'use client';
import { useState, useEffect, use } from 'react';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { 
  MapPin, Info, Navigation, Edit, Calendar, Image as ImageIcon, Maximize2 
} from 'lucide-react';

const MapaTDF = dynamic(() => import('../../../components/MapaTDF'), { 
  ssr: false,
  loading: () => <div className="h-full w-full bg-slate-900 animate-pulse flex items-center justify-center text-slate-500">Cargando Mapa...</div>
});

export default function DetalleLocacionPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const [locacion, setLocacion] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [isAdmin, setIsAdmin] = useState(false);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
 const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000'; 
  const tvScanline = { 
    backgroundImage: "linear-gradient(rgba(18, 16, 16, 0) 50%, rgba(0, 0, 0, 0.25) 50%), linear-gradient(90deg, rgba(255, 0, 0, 0.06), rgba(0, 255, 0, 0.02), rgba(0, 0, 255, 0.06))", 
    backgroundSize: "100% 2px, 3px 100%", 
    pointerEvents: "none" as const 
  };

  useEffect(() => {
    const checkUserRole = () => {
        const userStr = localStorage.getItem('user');
        if (userStr) {
            try {
                const user = JSON.parse(userStr);
                if (user.role === 'admin') setIsAdmin(true);
            } catch (e) {
                console.error("Error al parsear usuario:", e);
            }
        }
    };
    checkUserRole();

    let isMounted = true; // Para evitar actualizaciones si el componente se desmonta

    params.then(unwrap => {
        fetch(`${apiUrl}/locacion/${unwrap.id}`)
            .then(res => res.json())
            .then(data => {
                if (isMounted) {
                    const locConCoords = {
                        ...data,
                        lat: data.lat ? parseFloat(data.lat) : null,
                        lng: data.lng ? parseFloat(data.lng) : null
                    };
                    setLocacion(locConCoords);
                    setLoading(false);
                }
            })
            .catch(err => {
                console.error(err);
                if (isMounted) setLoading(false);
            });
    });

    return () => {
        isMounted = false; // Cleanup function
    };
  }, [params, apiUrl]);

  if (loading) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500"></div></div>;
  if (!locacion) return <div className="min-h-screen bg-slate-950 flex items-center justify-center text-red-400">Locación no encontrada</div>;

  const locacionesMap = [locacion];

  return (
    <div className="min-h-screen bg-slate-950 text-white font-sans pb-12 selection:bg-orange-500/30">
      
      {/* --- HERO SECTION --- */}
      <div className="relative h-[50vh] md:h-[60vh] w-full overflow-hidden group">
        {locacion.foto ? (
            <img src={locacion.foto} className="w-full h-full object-cover opacity-60 group-hover:scale-105 transition duration-[3s]" />
        ) : (
            <div className="w-full h-full bg-slate-900 flex items-center justify-center opacity-30"><MapPin size={100}/></div>
        )}
        
        <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/60 to-transparent"></div>
        <div className="absolute inset-0 z-10" style={tvScanline}></div>

        {isAdmin && (
          <div className="absolute top-24 left-0 w-full px-6 flex justify-center z-20">
            <Link href={`/locaciones/editar/${locacion.id}`} className="bg-orange-600 hover:bg-orange-500 px-5 py-2.5 rounded-full transition text-white shadow-lg shadow-orange-900/50 flex items-center gap-2 text-sm font-bold border border-orange-500/30">
              <Edit size={18}/> Editar locación
            </Link>
          </div>
        )}

        {/* --- CAMBIO 1: CENTRADO DEL TÍTULO --- */}
        <div className="absolute bottom-0 left-0 w-full p-6 md:p-16 z-20 animate-in slide-in-from-bottom duration-700 flex flex-col items-center text-center">
            
            <div className="flex flex-wrap justify-center gap-2 mb-4">
                <span className="bg-blue-600/20 text-blue-400 border border-blue-500/30 px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-widest backdrop-blur-md">
                    {locacion.categoria}
                </span>
                {locacion.subcategoria && (
                    <span className="bg-slate-800/50 text-slate-300 border border-slate-700/50 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-widest backdrop-blur-md">
                        {locacion.subcategoria}
                    </span>
                )}
            </div>
            
            <h1 className="text-4xl md:text-6xl lg:text-7xl font-black tracking-tighter text-white drop-shadow-2xl mb-4 max-w-4xl leading-tight">
                {locacion.nombre}
            </h1>
            
            <div className="flex items-center justify-center gap-3 text-lg md:text-xl text-slate-300 font-light bg-black/30 backdrop-blur-sm px-6 py-2 rounded-full border border-white/5">
                <MapPin size={20} className="text-orange-500 shrink-0"/> 
                {locacion.ciudad} 
                {locacion.direccion && (
                    <>
                        <span className="w-1 h-1 bg-slate-500 rounded-full mx-2 hidden md:block"></span>
                        <span className="text-sm text-slate-400 hidden md:block">{locacion.direccion}</span>
                    </>
                )}
            </div>
        </div>
      </div>

      {/* --- CONTENIDO PRINCIPAL --- */}
      <div className="max-w-7xl mx-auto px-6 -mt-8 relative z-30">
          {/* --- CAMBIO 2: GRID SIMÉTRICO (2 COLUMNAS IGUALES) --- */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-stretch">
              
              {/* COLUMNA IZQUIERDA: INFO + GALERÍA */}
              <div className="flex flex-col gap-8">
                  
                  {/* FICHA TÉCNICA */}
                  <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-8 shadow-xl flex-1">
                      <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2 border-b border-slate-800 pb-4">
                          <Info className="text-orange-500"/> Ficha Técnica
                      </h3>
                      
                      <div className="space-y-6">
                          <div>
                              <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Descripción</label>
                              <p className="text-slate-300 leading-relaxed text-sm whitespace-pre-line font-light">
                                  {locacion.descripcion || "Sin descripción detallada."}
                              </p>
                          </div>

                          {locacion.direccion && (
                              <div className="md:hidden">
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-1">Dirección</label>
                                  <p className="text-slate-300 text-sm">{locacion.direccion}</p>
                              </div>
                          )}

                          {locacion.accesibilidad && (
                              <div>
                                  <label className="text-[10px] font-bold text-slate-500 uppercase tracking-widest block mb-2">Accesibilidad</label>
                                  <div className="flex items-center gap-3 text-white bg-slate-950 p-4 rounded-xl border border-slate-800">
                                      <Navigation size={20} className="text-blue-400"/>
                                      <span className="text-sm font-medium">{locacion.accesibilidad}</span>
                                  </div>
                              </div>
                          )}

                          <div className="flex items-center gap-2 text-[10px] text-slate-600 mt-4 border-t border-slate-800 pt-4">
                              <Calendar size={12}/>
                              Actualizado el {new Date(locacion.createdAt).toLocaleDateString()}
                          </div>
                      </div>
                  </div>

                  {/* GALERÍA */}
                  {locacion.galeria && locacion.galeria.length > 0 && (
                      <div className="bg-slate-900/95 backdrop-blur border border-slate-800 rounded-3xl p-6 shadow-xl">
                          <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                              <ImageIcon size={16}/> Galería de Fotos
                          </h3>
                          <div className="grid grid-cols-3 gap-3">
                              {locacion.galeria.map((img: string, idx: number) => (
                                  <div 
                                    key={idx} 
                                    onClick={() => setSelectedImage(img)}
                                    className="relative aspect-square rounded-xl overflow-hidden cursor-pointer group border border-slate-800 hover:border-orange-500 transition-colors"
                                  >
                                      <img src={img} className="w-full h-full object-cover group-hover:scale-110 transition duration-500"/>
                                      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                          <Maximize2 size={20} className="text-white"/>
                                      </div>
                                  </div>
                              ))}
                          </div>
                      </div>
                  )}
              </div>

              {/* COLUMNA DERECHA: MAPA (OCUPA TODA LA ALTURA) */}
              <div className="h-[500px] lg:h-auto min-h-[500px] flex flex-col">
                  <div className="h-full w-full rounded-3xl overflow-hidden border-2 border-slate-800 shadow-2xl relative flex-1 bg-slate-900">
                      
                      {(locacion.lat && locacion.lng) ? (
                          <>
                            <div className="absolute top-4 left-4 z-10 bg-slate-950/90 backdrop-blur px-4 py-2 rounded-xl border border-slate-700 shadow-lg pointer-events-none">
                                <span className="text-[10px] font-bold text-slate-400 uppercase block mb-0.5">Coordenadas</span>
                                <span className="text-xs font-mono text-white font-bold">{locacion.lat.toFixed(4)}, {locacion.lng.toFixed(4)}</span>
                            </div>
                            <MapaTDF locaciones={locacionesMap} />
                          </>
                      ) : (
                          <div className="h-full w-full flex flex-col items-center justify-center text-slate-500 p-8 text-center">
                              <MapPin size={64} className="mb-4 opacity-20"/>
                              <h3 className="text-lg font-bold text-slate-400">Ubicación aproximada</h3>
                              <p className="text-sm max-w-md mt-2">Esta locación no tiene coordenadas GPS exactas cargadas en el sistema. Guíate por la referencia de ciudad: <span className="text-white">{locacion.ciudad}</span>.</p>
                          </div>
                      )}
                  </div>
              </div>

          </div>
      </div>

      {/* LIGHTBOX DE GALERÍA */}
      {selectedImage && (
          <div className="fixed inset-0 z-50 bg-black/90 backdrop-blur-md flex items-center justify-center p-4" onClick={() => setSelectedImage(null)}>
              <button className="absolute top-6 right-6 text-white/50 hover:text-white transition">
                  <div className="bg-white/10 p-2 rounded-full"><span className="text-2xl font-bold">✕</span></div>
              </button>
              <img src={selectedImage} className="max-w-full max-h-[90vh] rounded-xl shadow-2xl object-contain animate-in zoom-in-95 duration-300" />
          </div>
      )}

    </div>
  );
}