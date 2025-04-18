/*
  Warnings:

  - You are about to alter the column `imageUrl` on the `QueueEntry` table. The data in that column could be lost. The data in that column will be cast from `Text` to `VarChar(2048)`.
  - Changed the type of `artistName` on the `QueueEntry` table. No cast exists, the column would be dropped and recreated, which cannot be done if there is data, since the column is required.

*/
-- AlterTable
ALTER TABLE "QueueEntry" DROP COLUMN "artistName",
ADD COLUMN     "artistName" JSONB NOT NULL,
ALTER COLUMN "imageUrl" SET DATA TYPE VARCHAR(2048);

-- AlterTable
ALTER TABLE "Room" ADD COLUMN     "currentTrackIndex" INTEGER DEFAULT 0;
