/*
  Warnings:

  - You are about to drop the column `apellido` on the `Prestador` table. All the data in the column will be lost.
  - You are about to drop the column `ciudad` on the `Prestador` table. All the data in the column will be lost.
  - You are about to drop the column `dni` on the `Prestador` table. All the data in the column will be lost.
  - You are about to drop the `Administrador` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Perfil` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `descripcion` to the `Prestador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `rubro` to the `Prestador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `tipoPerfil` to the `Prestador` table without a default value. This is not possible if the table is not empty.
  - Added the required column `userId` to the `Prestador` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "Perfil" DROP CONSTRAINT "Perfil_prestadorId_fkey";

-- DropIndex
DROP INDEX "Prestador_dni_key";

-- DropIndex
DROP INDEX "Prestador_email_key";

-- AlterTable
ALTER TABLE "Prestador" DROP COLUMN "apellido",
DROP COLUMN "ciudad",
DROP COLUMN "dni",
ADD COLUMN     "descripcion" TEXT NOT NULL,
ADD COLUMN     "foto" TEXT,
ADD COLUMN     "rubro" TEXT NOT NULL,
ADD COLUMN     "telefono" TEXT,
ADD COLUMN     "tipoPerfil" TEXT NOT NULL,
ADD COLUMN     "userId" INTEGER NOT NULL,
ADD COLUMN     "web" TEXT;

-- DropTable
DROP TABLE "Administrador";

-- DropTable
DROP TABLE "Perfil";

-- CreateTable
CREATE TABLE "User" (
    "id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- AddForeignKey
ALTER TABLE "Prestador" ADD CONSTRAINT "Prestador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
