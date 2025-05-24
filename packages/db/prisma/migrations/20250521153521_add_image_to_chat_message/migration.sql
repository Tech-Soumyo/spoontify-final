-- AlterTable
ALTER TABLE "ChatMessage" ADD COLUMN     "imageUrl" VARCHAR(2048),
ALTER COLUMN "content" DROP NOT NULL;
