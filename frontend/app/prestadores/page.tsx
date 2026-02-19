'use client'; // 👈 IMPORTANTE: Esto le dice a Next.js "Esto corre en el navegador del usuario"

import { useState, useEffect } from 'react';

export default function PrestadoresPage() {
  // 1. ESTADOS (La memoria temporal de la página)
  const [prestadores, setPrestadores] = useState([]); // Lista de gente
  const [loading, setLoading] = useState(true);       // ¿Está cargando?
  const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
  // Datos del formulario nuevo
  const [formData, setFormData] = useState({
    nombre: '',
    apellido: '',
    dni: '',
    email: '',
    ciudad: 'Ushuaia'
  });



  async function fetchPrestadores() {
    try {
      // OJO: Como estamos en el navegador, usamos localhost
      const res = await fetch(`${apiUrl}/prestador`);
      const data = await res.json();
      setPrestadores(data);
      setLoading(false);
    } catch (error) {
      console.error("Error cargando:", error);
      setLoading(false);
    }
  }

    // 2. EFECTO: Cargar prestadores al entrar a la página
  useEffect(() => {
    fetchPrestadores();
  }, []);

  // 3. ACCIÓN: Guardar un prestador nuevo
  async function handleSubmit(e: any) {
    e.preventDefault(); // Evita que se recargue la página
    
    // Enviamos los datos al Backend
    const res = await fetch(`${apiUrl}/prestador`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData)
    });

    if (res.ok) {
      alert("¡Prestador creado con éxito! 🎥");
      fetchPrestadores(); // Recargamos la lista para ver al nuevo
      // Limpiamos el formulario
      setFormData({ ...formData, nombre: '', apellido: '', dni: '', email: '' });
    } else {
      alert("Error al crear. Revisa la consola.");
    }
  }

  return (
    <main className="min-h-screen p-8 bg-slate-900 text-white font-sans">
      <h1 className="text-3xl font-bold mb-8 text-orange-500 border-b border-gray-700 pb-4">
        Guía Audiovisual TDF
      </h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        
        {/* COLUMNA IZQUIERDA: Formulario de Alta */}
        <section className="bg-slate-800 p-6 rounded-lg border border-slate-700 h-fit">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            ➕ Nuevo Profesional
          </h2>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm text-gray-400 mb-1">Nombre</label>
              <input 
                type="text" 
                required
                className="w-full p-2 rounded bg-slate-900 border border-slate-600 focus:border-orange-500 outline-none"
                value={formData.nombre}
                onChange={(e) => setFormData({...formData, nombre: e.target.value})}
              />
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Apellido</label>
              <input 
                type="text" 
                required
                className="w-full p-2 rounded bg-slate-900 border border-slate-600 focus:border-orange-500 outline-none"
                value={formData.apellido}
                onChange={(e) => setFormData({...formData, apellido: e.target.value})}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-sm text-gray-400 mb-1">DNI</label>
                <input 
                  type="text" 
                  required
                  className="w-full p-2 rounded bg-slate-900 border border-slate-600 focus:border-orange-500 outline-none"
                  value={formData.dni}
                  onChange={(e) => setFormData({...formData, dni: e.target.value})}
                />
              </div>
              <div>
                <label className="block text-sm text-gray-400 mb-1">Ciudad</label>
                <select 
                  className="w-full p-2 rounded bg-slate-900 border border-slate-600 focus:border-orange-500 outline-none"
                  value={formData.ciudad}
                  onChange={(e) => setFormData({...formData, ciudad: e.target.value})}
                >
                  <option>Ushuaia</option>
                  <option>Río Grande</option>
                  <option>Tolhuin</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm text-gray-400 mb-1">Email</label>
              <input 
                type="email" 
                required
                className="w-full p-2 rounded bg-slate-900 border border-slate-600 focus:border-orange-500 outline-none"
                value={formData.email}
                onChange={(e) => setFormData({...formData, email: e.target.value})}
              />
            </div>

            <button type="submit" className="w-full bg-orange-600 hover:bg-orange-700 text-white font-bold py-2 px-4 rounded transition">
              Guardar Profesional
            </button>
          </form>
        </section>

        {/* COLUMNA DERECHA: Lista de Prestadores */}
        <section className="lg:col-span-2">
          <h2 className="text-xl font-bold mb-4 flex items-center gap-2">
            📋 Listado de Profesionales
          </h2>
          
          {loading ? (
            <p>Cargando datos...</p>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {prestadores.map((p: any) => (
                <div key={p.id} className="bg-slate-800 p-4 rounded-lg border border-slate-700 flex justify-between items-center hover:bg-slate-750">
                  <div>
                    <h3 className="font-bold text-lg">{p.nombre} {p.apellido}</h3>
                    <p className="text-orange-400 text-sm">{p.ciudad}</p>
                    <p className="text-gray-400 text-xs">{p.email}</p>
                  </div>
                  <div className="bg-slate-900 px-3 py-1 rounded text-xs border border-slate-700">
                    ID: {p.id}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

      </div>
    </main>
  );
}