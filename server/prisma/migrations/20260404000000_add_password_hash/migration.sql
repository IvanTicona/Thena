-- AlterTable: Add password_hash column with default empty string for existing rows
ALTER TABLE "users" ADD COLUMN "password_hash" VARCHAR(255) NOT NULL DEFAULT '';
