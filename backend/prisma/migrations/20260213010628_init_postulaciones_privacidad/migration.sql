-- CreateTable
CREATE TABLE "Postulacion" (
    "id" SERIAL NOT NULL,
    "mensaje" TEXT,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "proyectoId" INTEGER NOT NULL,
    "puestoId" INTEGER NOT NULL,
    "postulanteId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Postulacion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SolicitudContacto" (
    "id" SERIAL NOT NULL,
    "estado" TEXT NOT NULL DEFAULT 'Pendiente',
    "solicitanteId" INTEGER NOT NULL,
    "prestadorId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SolicitudContacto_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_proyectoId_fkey" FOREIGN KEY ("proyectoId") REFERENCES "Proyecto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_puestoId_fkey" FOREIGN KEY ("puestoId") REFERENCES "Puesto"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_postulanteId_fkey" FOREIGN KEY ("postulanteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudContacto" ADD CONSTRAINT "SolicitudContacto_solicitanteId_fkey" FOREIGN KEY ("solicitanteId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SolicitudContacto" ADD CONSTRAINT "SolicitudContacto_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
