-- AlterTable: agregar campo de mapa de profundidad (efecto 3D) junto a cada foto principal
ALTER TABLE "Prestador" ADD COLUMN "fotoProfundidad" TEXT;
ALTER TABLE "Locacion" ADD COLUMN "fotoProfundidad" TEXT;
ALTER TABLE "Proyecto" ADD COLUMN "fotoProfundidad" TEXT;
