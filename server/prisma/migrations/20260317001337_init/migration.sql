-- CreateExtension
CREATE EXTENSION IF NOT EXISTS "vector" WITH SCHEMA "public";

-- CreateEnum
CREATE TYPE "UserRole" AS ENUM ('STUDENT', 'TUTOR');

-- CreateEnum
CREATE TYPE "ChapterStatus" AS ENUM ('LOCKED', 'DRAFT', 'IN_REVIEW', 'APPROVED');

-- CreateEnum
CREATE TYPE "JobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AgentType" AS ENUM ('STRUCTURE', 'METHODOLOGY', 'COHERENCE');

-- CreateEnum
CREATE TYPE "AgentStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "ObservationSeverity" AS ENUM ('INFO', 'SUGGESTION', 'WARNING', 'ERROR');

-- CreateEnum
CREATE TYPE "KnowledgeLayer" AS ENUM ('TUTOR', 'INSTITUTIONAL');

-- CreateTable
CREATE TABLE "users" (
    "id" UUID NOT NULL,
    "email" VARCHAR(255) NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "role" "UserRole" NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "chapters" (
    "id" UUID NOT NULL,
    "number" SMALLINT NOT NULL,
    "title" VARCHAR(255) NOT NULL,
    "status" "ChapterStatus" NOT NULL DEFAULT 'LOCKED',
    "student_id" UUID NOT NULL,
    "approved_by" UUID,
    "approved_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "chapters_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "submissions" (
    "id" UUID NOT NULL,
    "chapter_id" UUID NOT NULL,
    "student_id" UUID NOT NULL,
    "version_number" INTEGER NOT NULL,
    "file_url" VARCHAR(500) NOT NULL,
    "file_name" VARCHAR(255) NOT NULL,
    "mime_type" VARCHAR(100) NOT NULL,
    "markdown_content" TEXT,
    "submitted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_jobs" (
    "id" UUID NOT NULL,
    "submission_id" UUID NOT NULL,
    "status" "JobStatus" NOT NULL DEFAULT 'QUEUED',
    "error_message" TEXT,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "duration_ms" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_jobs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "agent_results" (
    "id" UUID NOT NULL,
    "review_job_id" UUID NOT NULL,
    "agent_type" "AgentType" NOT NULL,
    "status" "AgentStatus" NOT NULL DEFAULT 'PENDING',
    "findings" JSONB,
    "started_at" TIMESTAMP(3),
    "completed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "agent_results_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "review_reports" (
    "id" UUID NOT NULL,
    "review_job_id" UUID NOT NULL,
    "summary_text" TEXT NOT NULL,
    "total_observations" INTEGER NOT NULL DEFAULT 0,
    "by_severity" JSONB NOT NULL DEFAULT '{}',
    "generated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "review_reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "observations" (
    "id" UUID NOT NULL,
    "agent_result_id" UUID NOT NULL,
    "review_report_id" UUID NOT NULL,
    "type" "AgentType" NOT NULL,
    "severity" "ObservationSeverity" NOT NULL,
    "message" TEXT NOT NULL,
    "suggestion" TEXT,
    "text_fragment" TEXT,
    "offset_start" INTEGER,
    "offset_end" INTEGER,
    "source_reference" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "observations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "knowledge_chunks" (
    "id" UUID NOT NULL,
    "layer" "KnowledgeLayer" NOT NULL,
    "owner_id" UUID,
    "source_document" VARCHAR(255) NOT NULL,
    "section_title" VARCHAR(255),
    "content" TEXT NOT NULL,
    "embedding" vector(1536),
    "chunk_index" INTEGER NOT NULL DEFAULT 0,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "knowledge_chunks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE UNIQUE INDEX "chapters_student_id_number_key" ON "chapters"("student_id", "number");

-- CreateIndex
CREATE INDEX "submissions_student_id_submitted_at_idx" ON "submissions"("student_id", "submitted_at" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "submissions_chapter_id_version_number_key" ON "submissions"("chapter_id", "version_number");

-- CreateIndex
CREATE UNIQUE INDEX "review_jobs_submission_id_key" ON "review_jobs"("submission_id");

-- CreateIndex
CREATE UNIQUE INDEX "agent_results_review_job_id_agent_type_key" ON "agent_results"("review_job_id", "agent_type");

-- CreateIndex
CREATE UNIQUE INDEX "review_reports_review_job_id_key" ON "review_reports"("review_job_id");

-- CreateIndex
CREATE INDEX "observations_review_report_id_idx" ON "observations"("review_report_id");

-- CreateIndex
CREATE INDEX "observations_agent_result_id_idx" ON "observations"("agent_result_id");

-- CreateIndex
CREATE INDEX "knowledge_chunks_layer_owner_id_idx" ON "knowledge_chunks"("layer", "owner_id");

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "chapters" ADD CONSTRAINT "chapters_approved_by_fkey" FOREIGN KEY ("approved_by") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_chapter_id_fkey" FOREIGN KEY ("chapter_id") REFERENCES "chapters"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "submissions" ADD CONSTRAINT "submissions_student_id_fkey" FOREIGN KEY ("student_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_jobs" ADD CONSTRAINT "review_jobs_submission_id_fkey" FOREIGN KEY ("submission_id") REFERENCES "submissions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "agent_results" ADD CONSTRAINT "agent_results_review_job_id_fkey" FOREIGN KEY ("review_job_id") REFERENCES "review_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "review_reports" ADD CONSTRAINT "review_reports_review_job_id_fkey" FOREIGN KEY ("review_job_id") REFERENCES "review_jobs"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_agent_result_id_fkey" FOREIGN KEY ("agent_result_id") REFERENCES "agent_results"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_review_report_id_fkey" FOREIGN KEY ("review_report_id") REFERENCES "review_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "knowledge_chunks" ADD CONSTRAINT "knowledge_chunks_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
