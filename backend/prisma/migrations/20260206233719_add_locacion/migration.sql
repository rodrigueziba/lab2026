-- CreateTable
CREATE TABLE "Locacion" (
    "id" SERIAL NOT NULL,
    "nombre" TEXT NOT NULL,
    "ciudad" TEXT NOT NULL,
    "descripcion" TEXT,
    "direccion" TEXT,
    "coordenadas" TEXT,
    "foto" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Locacion_pkey" PRIMARY KEY ("id")
);
