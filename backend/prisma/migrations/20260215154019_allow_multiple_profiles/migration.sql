/*
  Warnings:

  - Made the column `userId` on table `Prestador` required. This step will fail if there are existing NULL values in that column.

*/
-- DropForeignKey
ALTER TABLE "Prestador" DROP CONSTRAINT "Prestador_userId_fkey";

-- DropIndex
DROP INDEX "Prestador_userId_key";

-- AlterTable
ALTER TABLE "Prestador" ALTER COLUMN "userId" SET NOT NULL;

-- AddForeignKey
ALTER TABLE "Prestador" ADD CONSTRAINT "Prestador_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
