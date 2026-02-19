-- AlterTable
ALTER TABLE "Prestador" ADD COLUMN     "colorTema" TEXT DEFAULT '#ea580c',
ADD COLUMN     "galeria" TEXT[],
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "videoReel" TEXT;
