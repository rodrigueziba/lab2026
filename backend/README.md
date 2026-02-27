<p align="center">
  <a href="http://nestjs.com/" target="blank"><img src="https://nestjs.com/img/logo-small.svg" width="120" alt="Nest Logo" /></a>
</p>

[circleci-image]: https://img.shields.io/circleci/build/github/nestjs/nest/master?token=abc123def456
[circleci-url]: https://circleci.com/gh/nestjs/nest

  <p align="center">A progressive <a href="http://nodejs.org" target="_blank">Node.js</a> framework for building efficient and scalable server-side applications.</p>
    <p align="center">
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/v/@nestjs/core.svg" alt="NPM Version" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/l/@nestjs/core.svg" alt="Package License" /></a>
<a href="https://www.npmjs.com/~nestjscore" target="_blank"><img src="https://img.shields.io/npm/dm/@nestjs/common.svg" alt="NPM Downloads" /></a>
<a href="https://circleci.com/gh/nestjs/nest" target="_blank"><img src="https://img.shields.io/circleci/build/github/nestjs/nest/master" alt="CircleCI" /></a>
<a href="https://coveralls.io/github/nestjs/nest?branch=master" target="_blank"><img src="https://coveralls.io/repos/github/nestjs/nest/badge.svg?branch=master#9" alt="Coverage" /></a>
<a href="https://discord.gg/G7Qnnhy" target="_blank"><img src="https://img.shields.io/badge/discord-online-brightgreen.svg" alt="Discord"/></a>
<a href="https://opencollective.com/nest#backer" target="_blank"><img src="https://opencollective.com/nest/backers/badge.svg" alt="Backers on Open Collective" /></a>
<a href="https://opencollective.com/nest#sponsor" target="_blank"><img src="https://opencollective.com/nest/sponsors/badge.svg" alt="Sponsors on Open Collective" /></a>
  <a href="https://paypal.me/kamilmysliwiec" target="_blank"><img src="https://img.shields.io/badge/Donate-PayPal-ff3f59.svg" alt="Donate us"/></a>
    <a href="https://opencollective.com/nest#sponsor"  target="_blank"><img src="https://img.shields.io/badge/Support%20us-Open%20Collective-41B883.svg" alt="Support us"></a>
  <a href="https://twitter.com/nestframework" target="_blank"><img src="https://img.shields.io/twitter/follow/nestframework.svg?style=social&label=Follow" alt="Follow us on Twitter"></a>
</p>
  <!--[![Backers on Open Collective](https://opencollective.com/nest/backers/badge.svg)](https://opencollective.com/nest#backer)
  [![Sponsors on Open Collective](https://opencollective.com/nest/sponsors/badge.svg)](https://opencollective.com/nest#sponsor)-->

## Description

[Nest](https://github.com/nestjs/nest) framework TypeScript starter repository.

## Project setup

```bash
$ npm install
```

## Variables de entorno

En tu `.env` del backend conviene tener al menos:

- **`DATABASE_URL`** – Conexión a PostgreSQL (obligatoria).
- **`DEEPSEEK_API_KEY`** (opcional) – Para: (1) **Generar con IA** en **Crear perfil profesional** (`/mi-perfil/crear`) — si no tenés `GEMINI_API_KEY`, se usa DeepSeek para la biografía; (2) **Sugerir puestos** en **Crear proyecto** (`/mis-proyectos/crear`) — la IA sugiere vacantes según sinopsis y tipo de producción. [DeepSeek](https://platform.deepseek.com/) tiene tier gratuito.

## Base de datos y seed

Asegúrate de tener `DATABASE_URL` en tu `.env`. Luego:

```bash
# Crear tablas
$ npx prisma migrate deploy

# Poblar con datos de ejemplo (usuarios, locaciones, prestadores, proyectos TDF)
$ npm run seed
```

El seed crea usuarios (admin@tdffilm.com, productor@tdffilm.com, maria@tdffilm.com con contraseña `password123`), locaciones, prestadores y proyectos. Los usuarios se crean o actualizan siempre (upsert por email). Locaciones, prestadores y proyectos solo se insertan si sus tablas están vacías. Si ya tienes datos y no ves nada nuevo, vacía esas tablas o usa una base de datos limpia antes de ejecutar el seed.

**Alternativa con Supabase:** puedes ejecutar el script SQL desde el panel de Supabase en lugar de `npm run seed`. En la carpeta `prisma` está el archivo `seed-supabase.sql`: en Supabase Dashboard → SQL Editor → New query, pega el contenido del archivo y ejecuta. Crea/actualiza los mismos usuarios y opcionalmente las locaciones (solo si la tabla está vacía). Para prestadores y proyectos, después puedes correr `npm run seed` una vez con `DATABASE_URL` apuntando a Supabase.

## Errores frecuentes de base de datos

### "Can't reach database server at ... pooler.supabase.com:5432"
- **Causa:** El backend no puede conectar con Supabase (red, firewall o proyecto pausado).
- **Qué revisar:**
  1. **Proyecto pausado:** En Supabase Dashboard → Project Settings, si el proyecto está en plan free y estuvo inactivo, puede estar pausado. Entrá al proyecto y esperá a que reactive.
  2. **Docker:** Si el backend corre en Docker, el contenedor debe tener salida a internet. Probá desde el host: `curl -v telnet://aws-1-sa-east-1.pooler.supabase.com 5432`. Si falla, revisá red/VPN/firewall.
  3. **`backend/.env`:** Confirmá que `DATABASE_URL` sea la **Connection pooling** (modo Transaction) de Supabase: en Dashboard → Project Settings → Database → "Connection string" → "URI" con el pooler (puerto 5432). No uses el puerto 6543 si Prisma no está configurado para PgBouncer en ese modo.

### "Timed out fetching a new connection from the connection pool"
- **Causa:** Se abren demasiadas conexiones y el pool de Supabase se agota.
- **Solución:** En `backend/.env`, en la `DATABASE_URL` agregá al final (antes de cualquier `#`):  
  `?connection_limit=5`  
  Ejemplo:  
  `DATABASE_URL="postgresql://postgres.xxx:YYY@aws-1-sa-east-1.pooler.supabase.com:5432/postgres?connection_limit=5"`  
  Reiniciá el backend después de cambiar el `.env`.

## Compile and run the project

```bash
# development
$ npm run start

# watch mode
$ npm run start:dev

# production mode
$ npm run start:prod
```

## Run tests

```bash
# unit tests
$ npm run test

# e2e tests
$ npm run test:e2e

# test coverage
$ npm run test:cov
```

## Deployment

When you're ready to deploy your NestJS application to production, there are some key steps you can take to ensure it runs as efficiently as possible. Check out the [deployment documentation](https://docs.nestjs.com/deployment) for more information.

If you are looking for a cloud-based platform to deploy your NestJS application, check out [Mau](https://mau.nestjs.com), our official platform for deploying NestJS applications on AWS. Mau makes deployment straightforward and fast, requiring just a few simple steps:

```bash
$ npm install -g mau
$ mau deploy
```

With Mau, you can deploy your application in just a few clicks, allowing you to focus on building features rather than managing infrastructure.

## Resources

Check out a few resources that may come in handy when working with NestJS:

- Visit the [NestJS Documentation](https://docs.nestjs.com) to learn more about the framework.
- For questions and support, please visit our [Discord channel](https://discord.gg/G7Qnnhy).
- To dive deeper and get more hands-on experience, check out our official video [courses](https://courses.nestjs.com/).
- Deploy your application to AWS with the help of [NestJS Mau](https://mau.nestjs.com) in just a few clicks.
- Visualize your application graph and interact with the NestJS application in real-time using [NestJS Devtools](https://devtools.nestjs.com).
- Need help with your project (part-time to full-time)? Check out our official [enterprise support](https://enterprise.nestjs.com).
- To stay in the loop and get updates, follow us on [X](https://x.com/nestframework) and [LinkedIn](https://linkedin.com/company/nestjs).
- Looking for a job, or have a job to offer? Check out our official [Jobs board](https://jobs.nestjs.com).

## Support

Nest is an MIT-licensed open source project. It can grow thanks to the sponsors and support by the amazing backers. If you'd like to join them, please [read more here](https://docs.nestjs.com/support).

## Stay in touch

- Author - [Kamil Myśliwiec](https://twitter.com/kammysliwiec)
- Website - [https://nestjs.com](https://nestjs.com/)
- Twitter - [@nestframework](https://twitter.com/nestframework)

## License

Nest is [MIT licensed](https://github.com/nestjs/nest/blob/master/LICENSE).
