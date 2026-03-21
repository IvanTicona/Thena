export class KnowledgeDocumentResponse {
  sourceDocument: string;
  layer: string;
  chunkCount: number;
  lastUpdated: Date | null;
}

export class KnowledgeDeleteResponse {
  sourceDocument: string;
  deletedChunks: number;
}
