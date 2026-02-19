-- AlterTable
ALTER TABLE "Prestador" ADD COLUMN     "fechaNacimiento" TIMESTAMP(3),
ADD COLUMN     "formacion" TEXT;

-- CreateTable
CREATE TABLE "Experiencia" (
    "id" SERIAL NOT NULL,
    "proyecto" TEXT NOT NULL,
    "anio" TEXT NOT NULL,
    "rol" TEXT NOT NULL,
    "prestadorId" INTEGER NOT NULL,

    CONSTRAINT "Experiencia_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "Experiencia" ADD CONSTRAINT "Experiencia_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE CASCADE ON UPDATE CASCADE;
