-- AlterTable
ALTER TABLE "Prestador" ADD COLUMN     "colorFondo" TEXT DEFAULT '#1a6b9e',
ADD COLUMN     "galeriaInteractivaHabilitada" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "musicaYoutubeUrl" TEXT;
