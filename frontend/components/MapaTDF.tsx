'use client';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { useEffect } from 'react';
import Link from 'next/link';

// --- CENTRO INICIAL: Tierra del Fuego (Ushuaia / canal Beagle) ---
const CENTRO_TDF: [number, number] = [-54.8019, -68.303];
const ZOOM_INICIAL = 8;

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

// --- Fija la vista inicial en Tierra del Fuego al montar el mapa ---
function SetInitialViewTDF() {
  const map = useMap();
  useEffect(() => {
    map.setView(CENTRO_TDF, ZOOM_INICIAL);
  }, [map]);
  return null;
}

// --- Ajusta el centro solo cuando hay locaciones con coordenadas válidas en TDF ---
function UpdateMapCenter({ locations }: { locations: any[] }) {
  const map = useMap();

  useEffect(() => {
    if (!locations || locations.length === 0) return;

    const validos = locations
      .map(loc => ({ lat: Number(loc.lat), lng: Number(loc.lng) }))
      .filter(loc => isValidCoord(loc.lat) && isValidCoord(loc.lng));

    if (validos.length === 0) return;

    try {
      const avgLat = validos.reduce((acc, curr) => acc + curr.lat, 0) / validos.length;
      const avgLng = validos.reduce((acc, curr) => acc + curr.lng, 0) / validos.length;
      if (isValidCoord(avgLat) && isValidCoord(avgLng)) {
        map.flyTo([avgLat, avgLng], 9, { duration: 1.5 });
      }
    } catch (e) {
      console.warn("Error calculando centro del mapa:", e);
    }
  }, [locations, map]);

  return null;
}

// --- Overlay de texto "Islas Malvinas" (posición aproximada de las islas) ---
const MALVINAS_POS: [number, number] = [-51.7, -59.5];
const malvinasLabelIcon = L.divIcon({
  className: 'malvinas-label-leaflet',
  html: '<span class="malvinas-label-text">Islas Malvinas</span>',
  iconSize: [140, 28],
  iconAnchor: [70, 14],
});

export default function MapaTDF({ locaciones }: { locaciones: any[] }) {
  const centroTDF = CENTRO_TDF;

  // Filtramos marcadores para el renderizado
  const marcadoresValidos = (locaciones || []).filter(loc => {
    const lat = Number(loc.lat);
    const lng = Number(loc.lng);
    return isValidCoord(lat) && isValidCoord(lng);
  });

  return (
    <div className="h-full w-full relative z-0 isolate">
      <style jsx global>{`
        .malvinas-label-leaflet { border: none !important; background: none !important; }
        .malvinas-label-text {
          font-size: 13px; font-weight: 700; color: #f8fafc;
          text-shadow: 0 0 4px rgba(0,0,0,0.9), 0 1px 2px rgba(0,0,0,0.8);
          white-space: nowrap; background: rgba(15, 23, 42, 0.85);
          padding: 4px 10px; border-radius: 6px; border: 1px solid rgba(248,250,252,0.2);
        }
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
        zoom={ZOOM_INICIAL}
        style={{ height: '100%', width: '100%', background: '#020617' }}
        scrollWheelZoom={true}
      >
        <TileLayer
          attribution='&copy; OpenStreetMap &copy; CARTO'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        <SetInitialViewTDF />
        <UpdateMapCenter locations={locaciones} />

        {/* Etiqueta Islas Malvinas (sobre el mapa, nombre argentino) */}
        <Marker position={MALVINAS_POS} icon={malvinasLabelIcon} zIndexOffset={0} interactive={false} />

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