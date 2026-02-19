/*
  Warnings:

  - A unique constraint covering the columns `[userId]` on the table `Prestador` will be added. If there are existing duplicate values, this will fail.

*/
-- DropForeignKey
ALTER TABLE "Prestador" DROP CONSTRAINT "Prestador_userId_fkey";

-- AlterTable
ALTER TABLE "Prestador" ADD COLUMN     "ciudad" TEXT DEFAULT 'Ushuaia',
ALTER COLUMN "userId" DROP NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Prestador_userId_key" ON "Prestador"("userId");

-- AddForeignKey
ALTER TABLE "Prestador" ADD CONSTRAINT "Prestador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
