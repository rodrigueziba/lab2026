-- CreateTable
CREATE TABLE "Prestador" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellido" TEXT NOT NULL,
    "dni" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Prestador_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Perfil" (
    "id" SERIAL NOT NULL,
    "nombreEntidad" TEXT,
    "imagenPerfil" TEXT,
    "experienciaLaboral" TEXT,
    "reel" TEXT,
    "telefono" TEXT,
    "emailContacto" TEXT,
    "prestadorId" INTEGER NOT NULL,

    CONSTRAINT "Perfil_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Prestador_dni_key" ON "Prestador"("dni");

-- CreateIndex
CREATE UNIQUE INDEX "Prestador_email_key" ON "Prestador"("email");

-- AddForeignKey
ALTER TABLE "Perfil" ADD CONSTRAINT "Perfil_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
