-- Enable pgvector and add the embedding column Prisma has no native type for.
CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE "chunks" ADD COLUMN "embedding" vector(384);

-- ivfflat index for approximate nearest-neighbor cosine search.
-- lists=100 is a reasonable default for a few hundred thousand chunks; retune as the corpus grows.
CREATE INDEX chunks_embedding_idx ON "chunks" USING ivfflat (embedding vector_cosine_ops) WITH (lists = 100);
