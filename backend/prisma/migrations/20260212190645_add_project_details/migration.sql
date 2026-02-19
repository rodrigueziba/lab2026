-- AlterTable
ALTER TABLE "Proyecto" ADD COLUMN     "esEstudiante" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "esRemunerado" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "fechaFin" TIMESTAMP(3),
ADD COLUMN     "fechaInicio" TIMESTAMP(3),
ADD COLUMN     "galeria" TEXT[],
ADD COLUMN     "referencias" TEXT[];
