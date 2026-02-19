'use client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';
import Link from 'next/link';

// --- CONFIGURACIÓN DE ICONOS ---
const iconUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon.png';
const iconRetinaUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-icon-2x.png';
const shadowUrl = 'https://unpkg.com/leaflet@1.7.1/dist/images/marker-shadow.png';

const customIcon = L.icon({
  iconUrl,
  iconRetinaUrl,
  shadowUrl,
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  tooltipAnchor: [16, -28],
  shadowSize: [41, 41]
});

// --- HELPER PARA VALIDAR NÚMEROS ---
const isValidCoord = (n: any) => {
  return typeof n === 'number' && !isNaN(n) && isFinite(n);
};

// --- COMPONENTE DE ACTUACIÓN DE CÁMARA (FIXED) ---
function UpdateMapCenter({ locations }: { locations: any[] }) {
  const map = useMap();
  
  useEffect(() => {
    if (!locations || locations.length === 0) return;

    // 1. Filtrar coordenadas estrictamente válidas y convertirlas a número
    const validos = locations
      .map(loc => ({
        ...loc,
        lat: Number(loc.lat),
        lng: Number(loc.lng)
      }))
      .filter(loc => isValidCoord(loc.lat) && isValidCoord(loc.lng));

    // 2. Si no hay coordenadas válidas, no hacemos nada (evita división por cero)
    if (validos.length === 0) return;

    try {
      // 3. Calcular promedio con seguridad de tipos
      const totalLat = validos.reduce((acc, curr) => acc + curr.lat, 0);
      const totalLng = validos.reduce((acc, curr) => acc + curr.lng, 0);
      
      const avgLat = totalLat / validos.length;
      const avgLng = totalLng / validos.length;

      // 4. Verificación final antes de llamar a Leaflet
      if (isValidCoord(avgLat) && isValidCoord(avgLng)) {
        map.flyTo([avgLat, avgLng], 9, { duration: 1.5 });
      }
    } catch (error) {
      console.warn("Error calculando centro del mapa:", error);
    }
  }, [locations, map]);
  
  return null;
}

export default function MapaTDF({ locaciones }: { locaciones: any[] }) {
  // Centro por defecto (Tierra del Fuego) seguro
  const centroTDF: [number, number] = [-54.5108, -67.1925];

  // Filtramos marcadores para el renderizado
  const marcadoresValidos = (locaciones || []).filter(loc => {
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    return isValidCoord(lat) && isValidCoord(lng);
  });

  return (
    <div className="h-full w-full relative z-0 isolate">
      <style jsx global>{`
        .leaflet-popup-content-wrapper, .leaflet-popup-tip {
          background-color: #0f172a !important;
          border: 1px solid #1e293b;
          color: white !important;
          padding: 0 !important;
          overflow: hidden;
          border-radius: 12px !important;
        }
        .leaflet-popup-content {
          margin: 0 !important;
          width: 280px !important;
        }
        .leaflet-popup-close-button {
          color: white !important;
          top: 8px !important;
          right: 8px !important;
          text-shadow: 0 0 5px black;
        }
        .popup-animate {
          animation: fadeInUp 0.4s ease-out forwards;
        }
        @keyframes fadeInUp {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      <MapContainer 
        center={centroTDF} 
        zoom={8} 
        style={{ height: '100%', width: '100%', background: '#020617' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <UpdateMapCenter locations={locaciones} />

        {marcadoresValidos.map((loc) => (
          <Marker 
            key={loc.id} 
            position={[Number(loc.lat), Number(loc.lng)]} 
            icon={customIcon}
          >
            <Popup closeButton={true} className="custom-popup">
              <Link href={`/locaciones/${loc.id}`} className="block group popup-animate">
                <div className="flex flex-col">
                  <div className="relative h-32 w-full overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-t from-slate-900 to-transparent z-10 opacity-80"></div>
                    <img 
                      src={loc.foto || 'https://via.placeholder.com/300x200'} 
                      alt={loc.nombre} 
                      className="w-full h-full object-cover group-hover:scale-110 transition duration-700"
                    />
                    <span className="absolute bottom-2 left-3 z-20 text-[10px] font-black uppercase tracking-widest text-blue-400 bg-slate-950/80 px-2 py-0.5 rounded backdrop-blur-sm">
                      {loc.categoria}
                    </span>
                  </div>
                  <div className="p-4 text-center">
                    <h3 className="text-lg font-bold text-white mb-1 leading-tight group-hover:text-blue-400 transition">
                      {loc.nombre}
                    </h3>
                    <div className="text-slate-400 text-xs font-light flex items-center justify-center gap-1 mb-3">
                      📍 {loc.ciudad}
                    </div>
                    <span className="inline-block bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-6 py-2 rounded-full transition-all shadow-lg shadow-blue-900/40">
                      Ver Detalles
                    </span>
                  </div>
                </div>
              </Link>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}