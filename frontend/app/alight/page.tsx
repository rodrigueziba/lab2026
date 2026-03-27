import ArteInteractiva from '@/components/ArteInteractiva';

export default function Home() {
  return (
    <div style={{ position: 'relative', width: '100vw', height: '100vh', overflow: 'hidden' }}>
      
      {/* CAPA 1: El Canvas 3D de fondo */}
      <div style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 0 }}>
        <ArteInteractiva />
      </div>

      {/* CAPA 2: Tu interfaz HTML por encima (El H1) */}
      {/* pointerEvents: 'none' es CLAVE aquí. Hace que si haces clic en el texto, 
          el clic "atraviese" el texto y lo reciba el Canvas de atrás para bloquear el mouse */}
      <div style={{ position: 'relative', zIndex: 10, pointerEvents: 'none', padding: '2rem' }}>
        <h1 style={{ color: 'white' }}>Experiencia de Arte Interactiva</h1>
      </div>
      
    </div>
  );
}