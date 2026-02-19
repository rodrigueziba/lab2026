/*
  Warnings:

  - You are about to drop the column `coordenadas` on the `Locacion` table. All the data in the column will be lost.
  - Added the required column `categoria` to the `Locacion` table without a default value. This is not possible if the table is not empty.

*/
-- AlterTable
ALTER TABLE "Locacion" DROP COLUMN "coordenadas",
ADD COLUMN     "accesibilidad" TEXT,
ADD COLUMN     "categoria" TEXT NOT NULL,
ADD COLUMN     "galeria" TEXT[],
ADD COLUMN     "subcategoria" TEXT;
