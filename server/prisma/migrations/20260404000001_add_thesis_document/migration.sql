-- Step 1: Create thesis_documents table
CREATE TABLE "thesis_documents" (
    "id" UUID NOT NULL,
    "title" VARCHAR(500) NOT NULL,
    "student_id" UUID NOT NULL,
    "tutor_id" UUID,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "thesis_documents_pkey" PRIMARY KEY ("id")
);

-- Unique constraint: one thesis per student
CREATE UNIQUE INDEX "thesis_documents_student_id_key" ON "thesis_documents"("student_id");

-- FK: thesis → student
ALTER TABLE "thesis_documents" ADD CONSTRAINT "thesis_documents_student_id_fkey"
    FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- FK: thesis → tutor (optional)
ALTER TABLE "thesis_documents" ADD CONSTRAINT "thesis_documents_tutor_id_fkey"
    FOREIGN KEY ("tutor_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Step 2: Backfill — create one thesis per student who has chapters
-- Title defaults to 'Proyecto de Grado'; tutor assigned to the first TUTOR user if any exists
INSERT INTO "thesis_documents" ("id", "title", "student_id", "tutor_id", "created_at", "updated_at")
SELECT
    gen_random_uuid(),
    'Proyecto de Grado',
    u.id,
    (SELECT id FROM "users" WHERE role = 'TUTOR' LIMIT 1),
    NOW(),
    NOW()
FROM "users" u
WHERE u.role = 'STUDENT'
  AND EXISTS (SELECT 1 FROM "chapters" c WHERE c.student_id = u.id);

-- Step 3: Add thesis_id column to chapters (nullable initially for backfill)
ALTER TABLE "chapters" ADD COLUMN "thesis_id" UUID;

-- Step 4: Backfill thesis_id from the newly created thesis_documents
UPDATE "chapters" c
SET thesis_id = td.id
FROM "thesis_documents" td
WHERE td.student_id = c.student_id;

-- Step 5: Make thesis_id NOT NULL
ALTER TABLE "chapters" ALTER COLUMN "thesis_id" SET NOT NULL;

-- Step 6: Add FK from chapters to thesis_documents
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_thesis_id_fkey"
    FOREIGN KEY ("thesis_id") REFERENCES "thesis_documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Step 7: Drop old unique constraint [student_id, number]
DROP INDEX "chapters_student_id_number_key";

-- Step 8: Add new unique constraint [thesis_id, number]
CREATE UNIQUE INDEX "chapters_thesis_id_number_key" ON "chapters"("thesis_id", "number");

-- Step 9: Drop old student_id FK from chapters
ALTER TABLE "chapters" DROP CONSTRAINT "chapters_student_id_fkey";

-- Step 10: Drop student_id column from chapters
ALTER TABLE "chapters" DROP COLUMN "student_id";
