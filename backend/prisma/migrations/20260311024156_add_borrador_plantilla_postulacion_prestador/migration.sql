-- AlterTable
ALTER TABLE "Postulacion" ADD COLUMN     "prestadorId" INTEGER;

-- AlterTable
ALTER TABLE "Proyecto" ADD COLUMN     "esBorrador" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "esPlantilla" BOOLEAN NOT NULL DEFAULT false;

-- AddForeignKey
ALTER TABLE "Postulacion" ADD CONSTRAINT "Postulacion_prestadorId_fkey" FOREIGN KEY ("prestadorId") REFERENCES "Prestador"("id") ON DELETE SET NULL ON UPDATE CASCADE;
