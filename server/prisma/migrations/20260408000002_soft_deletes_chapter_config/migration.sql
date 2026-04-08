-- AlterTable: Add deletedAt to users
ALTER TABLE "users" ADD COLUMN "deleted_at" TIMESTAMP(3);

-- AlterTable: Add chapterCount and deletedAt to thesis_documents
ALTER TABLE "thesis_documents" ADD COLUMN "chapter_count" INTEGER NOT NULL DEFAULT 5;
ALTER TABLE "thesis_documents" ADD COLUMN "deleted_at" TIMESTAMP(3);
