'use client';
import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import Swal from 'sweetalert2';
import { 
  Users, Briefcase, Clapperboard, BarChart3, 
  ShieldCheck, MapIcon, Search, Shield, User, 
  Trash2, Edit, Filter, LayoutGrid, MapPin // <-- MapPin agregado aquí
} from 'lucide-react';
import { 
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, 
  PieChart, Pie, Cell, Legend 
} from 'recharts';

const TIPOS_PERFIL = ["Todos", "Profesional", "Productora", "Empresa", "Estudiante"];
const COLORS_PIE = ['#3b82f6', '#a855f7', '#f97316', '#10b981', '#ef4444'];

export default function AdminPanelPage() {
  const router = useRouter();
  // Agregamos 'locaciones' a los tabs posibles
  const [activeTab, setActiveTab] = useState<'stats' | 'usuarios' | 'prestadores' | 'proyectos' | 'locaciones'>('stats');

  // --- ESTADOS GLOBALES ---
  const [usuarios, setUsuarios] = useState<any[]>([]);
  const [prestadores, setPrestadores] = useState<any[]>([]);
  const [proyectos, setProyectos] = useState<any[]>([]);
  const [locaciones, setLocaciones] = useState<any[]>([]); // Nuevo estado para locaciones
  const [loading, setLoading] = useState(true);

  // --- ESTADOS DE FILTRADO ---
  const [searchUsuarios, setSearchUsuarios] = useState('');
  const [searchPrestadores, setSearchPrestadores] = useState('');
  const [filtroTipoPrestador, setFiltroTipoPrestador] = useState('Todos');
  const [searchProyectos, setSearchProyectos] = useState('');
  const [searchLocaciones, setSearchLocaciones] = useState(''); // Filtro locaciones

  // --- CARGA INICIAL DE DATOS ---
  useEffect(() => {
    const fetchAllData = async () => {
      setLoading(true);
      try {
        const token = localStorage.getItem('token');
        const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
        const headersAuth = token ? { 'Authorization': `Bearer ${token}` } : {};

        // Solicitamos todo en paralelo (user requiere token + admin)
        const [resUsers, resPrest, resProj, resLoc] = await Promise.all([
          fetch(`${apiUrl}/user`, { headers: headersAuth }),
          fetch(`${apiUrl}/prestador`),
          fetch(`${apiUrl}/proyecto`),
          fetch(`${apiUrl}/locacion`)
        ]);

        if (resUsers.ok) {
          const data = await resUsers.json();
          setUsuarios(Array.isArray(data) ? data : []);
        } else {
          setUsuarios([]);
          if (resUsers.status === 401 || resUsers.status === 403) {
            const err = await resUsers.json().catch(() => ({}));
            console.warn('Listado de usuarios no disponible:', err?.message || resUsers.status);
          }
        }
        if (resPrest.ok) setPrestadores(await resPrest.json());
        if (resProj.ok) setProyectos(await resProj.json());
        if (resLoc.ok) setLocaciones(await resLoc.json());
      } catch (error) {
        console.error("Error conectando con el servidor:", error);
      } finally {
        setLoading(false);
      }
    };
    fetchAllData();
  }, []);

  // --- CÁLCULO DINÁMICO DE ESTADÍSTICAS ---
  const statsData = useMemo(() => {
    const ciudadesCount = prestadores.reduce((acc: any, curr: any) => {
      const ciudad = curr.ciudad || 'No especificada';
      acc[ciudad] = (acc[ciudad] || 0) + 1;
      return acc;
    }, {});
    const ciudades = Object.keys(ciudadesCount).map(key => ({ name: key, cantidad: ciudadesCount[key] }));

    const tiposCount = prestadores.reduce((acc: any, curr: any) => {
      const tipo = curr.tipoPerfil || 'Otro';
      acc[tipo] = (acc[tipo] || 0) + 1;
      return acc;
    }, {});
    const tiposPrestador = Object.keys(tiposCount).map(key => ({ name: key, value: tiposCount[key] }));

    return { ciudades, tiposPrestador };
  }, [prestadores]);

  // --- ACCIONES CRUD ---

  const toggleAdminRole = async (id: number, currentRole: string) => {
    const newRole = currentRole === 'admin' ? 'user' : 'admin';
    const token = localStorage.getItem('token');
    const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

    setUsuarios(usuarios.map(u => u.id === id ? { ...u, role: newRole } : u));
    try {
      const res = await fetch(`${apiUrl}/user/${id}/role`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ role: newRole })
      });
      if (!res.ok) throw new Error();
    } catch (error) {
      Swal.fire({ title: 'Error', text: 'No se pudo cambiar el rol', icon: 'error', background: '#0f172a', color: '#fff' });
      setUsuarios(usuarios.map(u => u.id === id ? { ...u, role: currentRole } : u));
    }
  };

  const handleDeletePrestador = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar perfil?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', cancelButtonColor: '#334155', confirmButtonText: 'Sí, eliminar',
      background: '#0f172a', color: '#fff'
    });

    if (result.isConfirmed) {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      try {
        const res = await fetch(`${apiUrl}/prestador/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setPrestadores(prestadores.filter(p => p.id !== id));
          Swal.fire({ title: 'Eliminado', icon: 'success', background: '#0f172a', color: '#fff', confirmButtonColor: '#f97316' });
        } else {
          Swal.fire({ title: 'Error', text: data?.message || 'No se pudo eliminar el prestador', icon: 'error', background: '#0f172a', color: '#fff' });
        }
      } catch (error) {
        Swal.fire({ title: 'Error', text: 'Error de conexión al eliminar', icon: 'error', background: '#0f172a', color: '#fff' });
      }
    }
  };

  const handleDeleteProyecto = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar proyecto?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', cancelButtonColor: '#334155', confirmButtonText: 'Sí, eliminar',
      background: '#0f172a', color: '#fff'
    });

    if (result.isConfirmed) {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      try {
        const res = await fetch(`${apiUrl}/proyecto/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setProyectos(proyectos.filter(p => p.id !== id));
          Swal.fire({ title: 'Eliminado', icon: 'success', background: '#0f172a', color: '#fff', confirmButtonColor: '#f97316' });
        } else {
          Swal.fire({ title: 'Error', text: data?.message || 'No se pudo eliminar el proyecto', icon: 'error', background: '#0f172a', color: '#fff' });
        }
      } catch (error) {
        Swal.fire({ title: 'Error', text: 'Error de conexión al eliminar', icon: 'error', background: '#0f172a', color: '#fff' });
      }
    }
  };

  const handleDeleteLocacion = async (id: number) => {
    const result = await Swal.fire({
      title: '¿Eliminar locación?', icon: 'warning', showCancelButton: true,
      confirmButtonColor: '#ef4444', cancelButtonColor: '#334155', confirmButtonText: 'Sí, eliminar',
      background: '#0f172a', color: '#fff'
    });

    if (result.isConfirmed) {
      const token = localStorage.getItem('token');
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';
      try {
        const res = await fetch(`${apiUrl}/locacion/${id}`, { method: 'DELETE', headers: { 'Authorization': `Bearer ${token}` } });
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setLocaciones(locaciones.filter(l => l.id !== id));
          Swal.fire({ title: 'Eliminada', icon: 'success', background: '#0f172a', color: '#fff', confirmButtonColor: '#f97316' });
        } else {
          Swal.fire({ title: 'Error', text: data?.message || 'No se pudo eliminar la locación', icon: 'error', background: '#0f172a', color: '#fff' });
        }
      } catch (error) {
        Swal.fire({ title: 'Error', text: 'Error de conexión al eliminar', icon: 'error', background: '#0f172a', color: '#fff' });
      }
    }
  };

  // --- FILTRADO EN TIEMPO REAL ---
  const filteredUsuarios = usuarios.filter(u => 
    u.nombre?.toLowerCase().includes(searchUsuarios.toLowerCase()) || 
    u.email?.toLowerCase().includes(searchUsuarios.toLowerCase())
  );

  const filteredPrestadores = prestadores.filter(p => {
    const matchText = p.nombre?.toLowerCase().includes(searchPrestadores.toLowerCase()) || p.rubro?.toLowerCase().includes(searchPrestadores.toLowerCase());
    const matchTipo = filtroTipoPrestador === 'Todos' || p.tipoPerfil === filtroTipoPrestador;
    return matchText && matchTipo;
  });

  const filteredProyectos = proyectos.filter(p => 
    p.titulo?.toLowerCase().includes(searchProyectos.toLowerCase()) || 
    (p.tipo && String(p.tipo).toLowerCase().includes(searchProyectos.toLowerCase())) ||
    (p.estado && String(p.estado).toLowerCase().includes(searchProyectos.toLowerCase()))
  );

  const filteredLocaciones = locaciones.filter(l => 
    l.nombre?.toLowerCase().includes(searchLocaciones.toLowerCase()) || 
    l.ciudad?.toLowerCase().includes(searchLocaciones.toLowerCase()) ||
    l.categoria?.toLowerCase().includes(searchLocaciones.toLowerCase())
  );

  // --- COMPONENTES DE VISTA ---
  const VistaStats = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <h2 className="text-2xl font-black text-white mb-6">Resumen de la Industria</h2>
      
      {/* Tarjetas KPI ampliadas a 4 columnas */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Usuarios</p>
                    <h3 className="text-4xl font-black text-white">{loading ? '--' : usuarios.length}</h3>
                </div>
                <div className="p-3 bg-blue-500/10 text-blue-500 rounded-xl"><Users size={24}/></div>
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Prestadores</p>
                    <h3 className="text-4xl font-black text-white">{loading ? '--' : prestadores.length}</h3>
                </div>
                <div className="p-3 bg-orange-500/10 text-orange-500 rounded-xl"><Briefcase size={24}/></div>
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Proyectos</p>
                    <h3 className="text-4xl font-black text-white">{loading ? '--' : proyectos.length}</h3>
                </div>
                <div className="p-3 bg-red-500/10 text-red-500 rounded-xl"><Clapperboard size={24}/></div>
            </div>
        </div>
        <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-xl">
            <div className="flex justify-between items-start">
                <div>
                    <p className="text-slate-400 text-sm font-bold uppercase tracking-wider mb-1">Locaciones</p>
                    <h3 className="text-4xl font-black text-white">{loading ? '--' : locaciones.length}</h3>
                </div>
                <div className="p-3 bg-emerald-500/10 text-emerald-500 rounded-xl"><MapPin size={24}/></div>
            </div>
        </div>
      </div>

      {!loading && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl h-96 flex flex-col shadow-xl">
              <h3 className="text-white font-bold mb-6">Prestadores por Ciudad</h3>
              <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={statsData.ciudades}>
                          <XAxis dataKey="name" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                          <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} allowDecimals={false} />
                          <Tooltip 
                              cursor={{fill: '#1e293b'}}
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }}
                              itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                          />
                          <Bar dataKey="cantidad" fill="#f97316" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
              </div>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl h-96 flex flex-col shadow-xl">
              <h3 className="text-white font-bold mb-6">Tipos de Talento</h3>
              <div className="flex-1 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                          <Pie
                              data={statsData.tiposPrestador}
                              cx="50%"
                              cy="50%"
                              innerRadius={80}
                              outerRadius={120}
                              paddingAngle={5}
                              dataKey="value"
                              stroke="none"
                          >
                              {statsData.tiposPrestador.map((entry, index) => (
                                  <Cell key={`cell-${index}`} fill={COLORS_PIE[index % COLORS_PIE.length]} />
                              ))}
                          </Pie>
                          <Tooltip 
                              contentStyle={{ backgroundColor: '#0f172a', border: '1px solid #1e293b', borderRadius: '8px' }} 
                              itemStyle={{ color: '#f8fafc', fontWeight: 'bold' }}
                          />
                          <Legend iconType="circle" wrapperStyle={{ fontSize: '12px', color: '#94a3b8' }}/>
                      </PieChart>
                  </ResponsiveContainer>
              </div>
          </div>
        </div>
      )}
    </motion.div>
  );

  const VistaUsuarios = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-2xl font-black text-white">Gestión de Usuarios</h2>
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
              <input type="text" placeholder="Buscar usuario o email..." value={searchUsuarios} onChange={(e) => setSearchUsuarios(e.target.value)} className="bg-slate-900 border border-slate-800 text-white w-full text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"/>
          </div>
      </div>

      {usuarios.length === 0 && !loading && (
        <p className="text-amber-500/90 text-sm mb-4 bg-amber-500/10 border border-amber-500/20 rounded-xl px-4 py-3">Inicia sesión como administrador para ver el listado de usuarios.</p>
      )}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
        <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="p-4 font-bold">Nombre</th>
                    <th className="p-4 font-bold">Email</th>
                    <th className="p-4 font-bold">Fecha Reg.</th>
                    <th className="p-4 font-bold">Rol</th>
                    <th className="p-4 font-bold text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {filteredUsuarios.map(u => (
                    <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 text-white font-medium">{u.nombre}</td>
                        <td className="p-4 text-slate-400 text-sm">{u.email}</td>
                        <td className="p-4 text-slate-500 text-xs">{new Date(u.createdAt).toLocaleDateString()}</td>
                        <td className="p-4">
                            {u.role === 'admin' ? (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-emerald-500/10 text-emerald-500 text-[10px] font-bold uppercase tracking-wider border border-emerald-500/20"><ShieldCheck size={12}/> Admin</span>
                            ) : (
                                <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-800 text-slate-300 text-[10px] font-bold uppercase tracking-wider border border-slate-700"><User size={12}/> Base</span>
                            )}
                        </td>
                        <td className="p-4 text-right">
                            <button onClick={() => toggleAdminRole(u.id, u.role)} className={`text-xs font-bold px-3 py-1.5 rounded-lg transition-all ml-auto ${u.role === 'admin' ? 'bg-slate-800 text-slate-400 hover:text-red-500 border border-slate-700' : 'bg-orange-600 hover:bg-orange-500 text-white'}`}>
                                {u.role === 'admin' ? 'Quitar Admin' : 'Hacer Admin'}
                            </button>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </motion.div>
  );

  const VistaPrestadores = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-2xl font-black text-white">Directorio de Prestadores</h2>
          <div className="flex flex-col md:flex-row gap-3 w-full md:w-auto">
              <select value={filtroTipoPrestador} onChange={(e) => setFiltroTipoPrestador(e.target.value)} className="bg-slate-900 border border-slate-800 text-white text-sm rounded-xl px-4 py-2 focus:outline-none focus:border-orange-500 transition-colors">
                {TIPOS_PERFIL.map(tipo => <option key={tipo} value={tipo}>{tipo}</option>)}
              </select>
              <div className="relative w-full md:w-64">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
                  <input type="text" placeholder="Buscar nombre o rubro..." value={searchPrestadores} onChange={(e) => setSearchPrestadores(e.target.value)} className="bg-slate-900 border border-slate-800 text-white w-full text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"/>
              </div>
          </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
        <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="p-4 font-bold">Perfil</th>
                    <th className="p-4 font-bold">Tipo</th>
                    <th className="p-4 font-bold">Rubro</th>
                    <th className="p-4 font-bold">Ubicación</th>
                    <th className="p-4 font-bold text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {filteredPrestadores.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                                {p.foto ? <img src={p.foto} alt="foto" className="w-full h-full object-cover"/> : <User className="m-2 text-slate-500"/>}
                            </div>
                            <div>
                                <p className="text-white font-medium text-sm leading-tight">{p.nombre}</p>
                                <p className="text-slate-500 text-[10px]">{p.email || 'Sin email'}</p>
                            </div>
                        </td>
                        <td className="p-4"><span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md border border-slate-700">{p.tipoPerfil}</span></td>
                        <td className="p-4 text-slate-400 text-sm">{p.rubro}</td>
                        <td className="p-4 text-slate-400 text-sm flex items-center gap-1"><MapPin size={14}/> {p.ciudad}</td>
                        <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <Link href={`/prestador/${p.id}/editar`}>
                                    <button className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors border border-transparent hover:border-blue-500/30" title="Editar"><Edit size={16}/></button>
                                </Link>
                                <button onClick={() => handleDeletePrestador(p.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30" title="Eliminar"><Trash2 size={16}/></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </motion.div>
  );

  const VistaProyectos = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-2xl font-black text-white">Catálogo de Proyectos</h2>
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
              <input type="text" placeholder="Buscar proyecto..." value={searchProyectos} onChange={(e) => setSearchProyectos(e.target.value)} className="bg-slate-900 border border-slate-800 text-white w-full text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"/>
          </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
        <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="p-4 font-bold">Título del Proyecto</th>
                    <th className="p-4 font-bold">Tipo</th>
                    <th className="p-4 font-bold">Ubicación</th>
                    <th className="p-4 font-bold text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {filteredProyectos.map(p => (
                    <tr key={p.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4">
                            <p className="text-white font-medium text-sm">{p.titulo}</p>
                            <p className="text-slate-500 text-[10px] line-clamp-1 max-w-[200px]">{p.descripcion || p.sinopsis || 'Sin sinopsis'}</p>
                        </td>
                        <td className="p-4 text-slate-300 text-sm"><span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md border border-slate-700">{p.tipo || '—'}</span></td>
                        <td className="p-4 text-slate-400 text-sm flex items-center gap-1"><MapPin size={14}/> {p.ciudad || 'No definida'}</td>
                        <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <Link href={`/mis-proyectos/editar/${p.id}`}>
                                    <button className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors border border-transparent hover:border-blue-500/30"><Edit size={16}/></button>
                                </Link>
                                <button onClick={() => handleDeleteProyecto(p.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30"><Trash2 size={16}/></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </motion.div>
  );

  // --- VISTA LOCACIONES ---
  const VistaLocaciones = () => (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }} className="space-y-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 mb-6">
          <h2 className="text-2xl font-black text-white">Catálogo de Locaciones</h2>
          <div className="relative w-full md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18}/>
              <input type="text" placeholder="Buscar locación, ciudad..." value={searchLocaciones} onChange={(e) => setSearchLocaciones(e.target.value)} className="bg-slate-900 border border-slate-800 text-white w-full text-sm rounded-xl pl-10 pr-4 py-2 focus:outline-none focus:border-orange-500 transition-colors"/>
          </div>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-x-auto shadow-xl">
        <table className="w-full text-left border-collapse min-w-[700px]">
            <thead>
                <tr className="bg-slate-950/50 text-slate-400 text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="p-4 font-bold">Locación</th>
                    <th className="p-4 font-bold">Categoría</th>
                    <th className="p-4 font-bold">Ciudad</th>
                    <th className="p-4 font-bold">Estado</th>
                    <th className="p-4 font-bold text-right">Acciones</th>
                </tr>
            </thead>
            <tbody className="divide-y divide-slate-800">
                {filteredLocaciones.map(l => (
                    <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                        <td className="p-4 flex items-center gap-3">
                            <div className="w-12 h-10 rounded-md bg-slate-800 overflow-hidden shrink-0 border border-slate-700">
                                {l.foto ? <img src={l.foto} alt="locacion" className="w-full h-full object-cover"/> : <MapPin className="m-2 text-slate-500"/>}
                            </div>
                            <div>
                                <p className="text-white font-medium text-sm leading-tight">{l.nombre}</p>
                                <p className="text-slate-500 text-[10px] max-w-[150px] line-clamp-1">{l.descripcion || 'Sin descripción'}</p>
                            </div>
                        </td>
                        <td className="p-4"><span className="text-xs bg-slate-800 text-slate-300 px-2 py-1 rounded-md border border-slate-700">{l.categoria}</span></td>
                        <td className="p-4 text-slate-400 text-sm flex items-center gap-1 mt-2"><MapPin size={14}/> {l.ciudad}</td>
                        <td className="p-4 text-slate-400 text-sm">{l.estado || 'Activo'}</td>
                        <td className="p-4 text-right">
                            <div className="flex items-center justify-end gap-2">
                                <Link href={`/locaciones/editar/${l.id}`}>
                                    <button className="p-2 text-blue-500 hover:bg-blue-500/10 rounded-lg transition-colors border border-transparent hover:border-blue-500/30" title="Editar"><Edit size={16}/></button>
                                </Link>
                                <button onClick={() => handleDeleteLocacion(l.id)} className="p-2 text-red-500 hover:bg-red-500/10 rounded-lg transition-colors border border-transparent hover:border-red-500/30" title="Eliminar"><Trash2 size={16}/></button>
                            </div>
                        </td>
                    </tr>
                ))}
            </tbody>
        </table>
      </div>
    </motion.div>
  );

  return (
    <div className="min-h-screen bg-slate-950 flex flex-col md:flex-row pt-20 md:pt-24">
      
      {/* SIDEBAR LATERAL */}
      <aside className="w-full md:w-64 bg-slate-900 border-r border-slate-800 flex flex-col p-4 md:h-[calc(100vh-6rem)] md:sticky md:top-24 z-10 shrink-0">
        <div className="mb-8 px-4">
            <h1 className="text-xs font-black text-slate-500 uppercase tracking-[0.2em] mb-1">Panel de Control</h1>
            <p className="text-white font-bold flex items-center gap-2"><Shield size={16} className="text-orange-500"/> Master Admin</p>
        </div>

        <nav className="space-y-2 flex-1">
            <button onClick={() => setActiveTab('stats')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'stats' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <BarChart3 size={18}/> Estadísticas
            </button>
            <button onClick={() => setActiveTab('usuarios')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'usuarios' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Users size={18}/> Usuarios
            </button>
            <button onClick={() => setActiveTab('prestadores')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'prestadores' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Briefcase size={18}/> Prestadores
            </button>
            <button onClick={() => setActiveTab('proyectos')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'proyectos' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <Clapperboard size={18}/> Proyectos
            </button>
            {/* NUEVA OPCIÓN: LOCACIONES */}
            <button onClick={() => setActiveTab('locaciones')} className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-bold transition-all ${activeTab === 'locaciones' ? 'bg-orange-600 text-white shadow-lg shadow-orange-900/20' : 'text-slate-400 hover:bg-slate-800 hover:text-white'}`}>
                <MapPin size={18}/> Locaciones
            </button>
        </nav>

        {/* Link al Mapa Nodos 3D */}
        <div className="pt-4 border-t border-slate-800 mt-4">
            <button 
                onClick={() => router.push('/admin/dashboard')} 
                className="w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl text-xs font-bold text-white bg-slate-800 hover:bg-slate-700 transition-all border border-slate-700"
            >
                <MapIcon size={14}/> Ver Mapa Nodos 3D
            </button>
        </div>
      </aside>

      {/* ÁREA DE CONTENIDO PRINCIPAL */}
      <main className="flex-1 p-6 md:p-10 overflow-y-auto">
        <div className="max-w-6xl mx-auto">
            {loading ? (
                <div className="flex flex-col items-center justify-center h-64 text-orange-500">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-orange-500 mb-4"></div>
                    <p className="text-sm font-medium animate-pulse">Sincronizando base de datos...</p>
                </div>
            ) : (
                <AnimatePresence mode="wait">
                    {activeTab === 'stats' && <VistaStats key="stats" />}
                    {activeTab === 'usuarios' && <VistaUsuarios key="usuarios" />}
                    {activeTab === 'prestadores' && <VistaPrestadores key="prestadores" />}
                    {activeTab === 'proyectos' && <VistaProyectos key="proyectos" />}
                    {activeTab === 'locaciones' && <VistaLocaciones key="locaciones" />}
                </AnimatePresence>
            )}
        </div>
      </main>

    </div>
  );
}