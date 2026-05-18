-- DropForeignKey
ALTER TABLE "observations" DROP CONSTRAINT "observations_agent_result_id_fkey";

-- AlterTable
ALTER TABLE "submissions" ADD COLUMN     "source_document_url" VARCHAR(500);

-- AddForeignKey
ALTER TABLE "observations" ADD CONSTRAINT "observations_agent_result_id_fkey" FOREIGN KEY ("agent_result_id") REFERENCES "agent_results"("id") ON DELETE SET NULL ON UPDATE CASCADE;
