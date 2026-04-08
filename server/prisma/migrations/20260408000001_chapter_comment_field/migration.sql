-- Add optional comment field to chapters
-- Stores tutor feedback when approving or rejecting a chapter

ALTER TABLE "chapters" ADD COLUMN "comment" TEXT;
