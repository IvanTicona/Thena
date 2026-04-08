-- Make agent_result_id nullable to support tutor-created observations
-- that are not tied to an AI agent result

ALTER TABLE "observations" ALTER COLUMN "agent_result_id" DROP NOT NULL;
