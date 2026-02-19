# 🎬 Neural TDF - Film Commission Tierra del Fuego

[![Next.js](https://img.shields.io/badge/Frontend-Next.js_14-black?style=flat&logo=next.js)](https://nextjs.org/)
[![NestJS](https://img.shields.io/badge/Backend-NestJS-ea2845?style=flat&logo=nestjs)](https://nestjs.com/)
[![PostgreSQL](https://img.shields.io/badge/Database-PostgreSQL-4169E1?style=flat&logo=postgresql)](https://www.postgresql.org/)
[![Prisma](https://img.shields.io/badge/ORM-Prisma-2D3748?style=flat&logo=prisma)](https://www.prisma.io/)
[![Docker](https://img.shields.io/badge/Deploy-Docker-2496ED?style=flat&logo=docker)](https://www.docker.com/)

Film TDF es una plataforma integral diseñada para la **Film Commission de Tierra del Fuego**. Conecta locaciones, proyectos audiovisuales y talento local mediante una interfaz interactiva y un dashboard administrativo robusto.

---

## ✨ Características Principales

- **Mapa de nodos 3D:** Visualización interactiva en tiempo real de nodos (Locaciones, Proyectos, Prestadores) utilizando Shaders WebGL personalizados y físicas de grafos 3D.
- **Directorio de Prestadores:** Gestión de perfiles de profesionales, productoras, empresas y estudiantes.
- **Gestor de Proyectos:** Catálogo de producciones audiovisuales con sistema de control de etapas y roles.
- **Catálogo de Locaciones:** Base de datos de espacios disponibles para filmación en Tierra del Fuego (Ushuaia, Tolhuin, Río Grande).
- **Panel Administrativo (CMS):** Dashboard completo con gráficos estadísticos, gestión de roles de usuario (RBAC) y moderación de contenido.
- **Seguridad:** Autenticación mediante JWT, Guards de rutas en NestJS y cifrado bcrypt.

---

## 🏗️ Arquitectura del Sistema

El proyecto está dividido en un monorepo con dos aplicaciones principales:

1. **`/frontend`**: Desarrollado en React con **Next.js**. Utiliza `Tailwind CSS` para el diseño, `recharts` para analíticas, `lucide-react` para iconografía y `react-force-graph-3d` para la visualización nodal.
2. **`/backend`**: API REST desarrollada en Node.js con **NestJS**. Utiliza **Prisma ORM** para interactuar con una base de datos PostgreSQL alojada en Supabase.

---

## 🚀 Requisitos Previos

- [Node.js](https://nodejs.org/en/) (v18 o superior)
- [Docker](https://www.docker.com/) y Docker Compose (Para despliegue en producción)
- Base de datos PostgreSQL (ej. Supabase o local)

---

## 🛠️ Instalación y Entorno de Desarrollo

### 1. Clonar el repositorio
```bash
git clone [https://github.com/rodrigueziba/lab2026.git](https://github.com/rodrigueziba/lab2026.git)
cd lab2026