import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  const hash = await bcrypt.hash('password123', 10);

  const [numUsers, numLoc, numPrest, numProy] = await Promise.all([
    prisma.user.count(),
    prisma.locacion.count(),
    prisma.prestador.count(),
    prisma.proyecto.count(),
  ]);
  console.log(`Estado actual: ${numUsers} usuarios, ${numLoc} locaciones, ${numPrest} prestadores, ${numProy} proyectos.`);

  // 1. Usuarios (admin y usuarios normales) — upsert por email
  const admin = await prisma.user.upsert({
    where: { email: 'admin@tdffilm.com' },
    update: {},
    create: {
      email: 'admin@tdffilm.com',
      password: hash,
      nombre: 'Admin TDF',
      role: 'admin',
    },
  });

  const user1 = await prisma.user.upsert({
    where: { email: 'productor@tdffilm.com' },
    update: {},
    create: {
      email: 'productor@tdffilm.com',
      password: hash,
      nombre: 'Juan Pérez',
      role: 'user',
    },
  });

  const user2 = await prisma.user.upsert({
    where: { email: 'maria@tdffilm.com' },
    update: {},
    create: {
      email: 'maria@tdffilm.com',
      password: hash,
      nombre: 'María González',
      role: 'user',
    },
  });

  // 2. Locaciones — solo si no hay ninguna
  const countLoc = await prisma.locacion.count();
  if (countLoc === 0) {
    const locaciones = [
      { nombre: 'Laguna Esmeralda', ciudad: 'Ushuaia', categoria: 'Paisaje Natural', subcategoria: 'Lagos y lagunas', descripcion: 'Laguna de altura con turberas, ideal para exteriores de naturaleza.', direccion: 'Ruta Provincial 3', accesibilidad: 'Media (Caminata corta)', lat: -54.75, lng: -68.35, galeria: [] },
      { nombre: 'Puerto de Ushuaia', ciudad: 'Ushuaia', categoria: 'Urbano y Arquitectura', subcategoria: 'Puerto', descripcion: 'Muelle y edificios portuarios con vista al Canal Beagle.', direccion: 'Maipú 465', accesibilidad: 'Fácil (Vehículo)', lat: -54.8019, lng: -68.303, galeria: [] },
      { nombre: 'Glaciar Martial', ciudad: 'Ushuaia', categoria: 'Paisaje Natural', subcategoria: 'Glaciares', descripcion: 'Vista panorámica de Ushuaia y cordillera. Centro de esquí.', direccion: 'Av. Luis F. Martial', accesibilidad: 'Media (Caminata corta)', lat: -54.78, lng: -68.42, galeria: [] },
      { nombre: 'Estancia Harberton', ciudad: 'Ushuaia', categoria: 'Sitios Abandonados', subcategoria: 'Estancias', descripcion: 'Primera estancia fueguina, museo y naturaleza.', direccion: 'Ruta 3 Km 85', accesibilidad: 'Fácil (Vehículo)', lat: -54.87, lng: -67.08, galeria: [] },
      { nombre: 'Costanera Río Grande', ciudad: 'Río Grande', categoria: 'Urbano y Arquitectura', subcategoria: 'Calles céntricas', descripcion: 'Paseo costero y edificios de la ciudad.', direccion: 'Costanera', accesibilidad: 'Fácil (Vehículo)', lat: -53.7763, lng: -67.7164, galeria: [] },
      { nombre: 'Lago Fagnano', ciudad: 'Tolhuin', categoria: 'Paisaje Natural', subcategoria: 'Lagos y lagunas', descripcion: 'Lago extenso con bosque y playas. Muy cinematográfico.', direccion: 'Ruta 3', accesibilidad: 'Fácil (Vehículo)', lat: -54.51, lng: -67.19, galeria: [] },
    ];
    await prisma.locacion.createMany({ data: locaciones });
    console.log('Locaciones creadas.');
  }

  // 3. Prestadores — solo si no hay ninguno
  const countPrest = await prisma.prestador.count();
  if (countPrest === 0) {
    const rubros = ['Fotografía / Cámara', 'Sonido', 'Dirección', 'Producción', 'Montaje / Postproducción', 'Arte / Escenografía'];
    const tipos = ['Profesional', 'Productora', 'Empresa', 'Estudiante'];
    const nombresPrest = ['Cine del Fin', 'Pablo Sonido', 'Luz Austral', 'Producciones Fueguinas', 'Post TDF', 'Arte Sur'];
    for (let i = 0; i < nombresPrest.length; i++) {
      await prisma.prestador.create({
        data: {
          tipoPerfil: tipos[i % tipos.length],
          nombre: nombresPrest[i],
          rubro: rubros[i % rubros.length],
          descripcion: 'Perfil profesional radicado en Tierra del Fuego. Experiencia en producciones locales e internacionales.',
          email: `prestador${i + 1}@tdffilm.com`,
          telefono: i % 2 === 0 ? '+54 9 2901 123456' : undefined,
          web: i % 3 === 0 ? 'https://ejemplo.com' : undefined,
          ciudad: i % 3 === 0 ? 'Río Grande' : 'Ushuaia',
          userId: [user1.id, user2.id][i % 2],
          galeria: [],
        },
      });
    }
    console.log('Prestadores creados.');
  }

  // 4. Proyectos con puestos — solo si no hay ninguno
  const countProy = await prisma.proyecto.count();
  if (countProy === 0) {
    await prisma.proyecto.create({
      data: {
        titulo: 'Documental Fin del Mundo',
        tipo: 'Documental',
        ciudad: 'Ushuaia',
        descripcion: 'Serie documental sobre la vida en Tierra del Fuego.',
        estado: 'Abierto',
        esEstudiante: false,
        esRemunerado: true,
        referencias: [],
        galeria: [],
        userId: admin.id,
        puestos: {
          create: [
            { nombre: 'Director/a', descripcion: 'Con experiencia en documental' },
            { nombre: 'Cámara', descripcion: '' },
          ],
        },
      },
    });
    await prisma.proyecto.create({
      data: {
        titulo: 'Cortometraje Nieve',
        tipo: 'Cortometraje',
        ciudad: 'Ushuaia',
        descripcion: 'Ficción en locaciones invernales.',
        estado: 'En Producción',
        esEstudiante: true,
        esRemunerado: false,
        referencias: [],
        galeria: [],
        userId: user1.id,
        puestos: {
          create: [
            { nombre: 'Sonidista', descripcion: '' },
            { nombre: 'Gaffer', descripcion: '' },
          ],
        },
      },
    });
    await prisma.proyecto.create({
      data: {
        titulo: 'Videoclip Banda Local',
        tipo: 'Videoclip',
        ciudad: 'Río Grande',
        descripcion: 'Videoclip para banda de rock fueguina.',
        estado: 'Abierto',
        esEstudiante: false,
        esRemunerado: true,
        referencias: [],
        galeria: [],
        userId: user2.id,
        puestos: { create: [{ nombre: 'Director de fotografía', descripcion: '' }] },
      },
    });
    console.log('Proyectos creados.');
  }

  console.log('Seed completado.');
  console.log('Usuarios: admin@tdffilm.com / productor@tdffilm.com / maria@tdffilm.com — contraseña: password123');
  console.log('Nota: Locaciones, prestadores y proyectos solo se crean si sus tablas están vacías. Para ver datos nuevos en una DB ya usada, vacía esas tablas o usa una DB limpia.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
