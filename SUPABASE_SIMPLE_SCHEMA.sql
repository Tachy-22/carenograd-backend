-- Simple Multi-User RAG Database Setup (No RLS)
-- Run this SQL in your Supabase Dashboard → SQL Editor → New Query

-- Step 1: Enable pgvector extension for vector similarity search
CREATE EXTENSION IF NOT EXISTS vector;

-- Step 2: Create documents table with user isolation (NO RLS)
CREATE TABLE IF NOT EXISTS documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  filename TEXT NOT NULL,
  original_name TEXT NOT NULL,
  mime_type TEXT NOT NULL DEFAULT 'application/pdf',
  size_bytes INTEGER NOT NULL,
  file_path TEXT,
  upload_status TEXT NOT NULL DEFAULT 'pending' CHECK (upload_status IN ('pending', 'processing', 'completed', 'failed')),
  processing_error TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 3: Create document_chunks table with user isolation (NO RLS)
CREATE TABLE IF NOT EXISTS document_chunks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id UUID REFERENCES documents(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  content TEXT NOT NULL,
  chunk_index INTEGER NOT NULL,
  embedding vector(1536) NOT NULL, -- OpenAI text-embedding-3-small dimensions
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Step 4: Create performance indexes
-- HNSW index for fast vector similarity search
CREATE INDEX IF NOT EXISTS document_chunks_embedding_idx 
ON document_chunks USING hnsw (embedding vector_cosine_ops);

-- Indexes for user isolation and document lookups
CREATE INDEX IF NOT EXISTS documents_user_id_idx ON documents(user_id);
CREATE INDEX IF NOT EXISTS document_chunks_user_id_idx ON document_chunks(user_id);
CREATE INDEX IF NOT EXISTS document_chunks_document_id_idx ON document_chunks(document_id);

-- Step 5: Create RPC function for user-specific document search
CREATE OR REPLACE FUNCTION match_user_document_chunks(
  query_embedding vector(1536),
  match_threshold float DEFAULT 0.78,
  match_count int DEFAULT 10,
  user_id_filter uuid DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
  content text,
  metadata jsonb,
  similarity float
)
LANGUAGE plpgsql
AS $$
BEGIN
  RETURN QUERY
  SELECT
    document_chunks.id,
    document_chunks.document_id,
    document_chunks.content,
    document_chunks.metadata,
    (document_chunks.embedding <#> query_embedding) * -1 AS similarity
  FROM document_chunks
  WHERE 
    (user_id_filter IS NULL OR document_chunks.user_id = user_id_filter)
    AND (document_chunks.embedding <#> query_embedding) * -1 > match_threshold
  ORDER BY document_chunks.embedding <#> query_embedding
  LIMIT match_count;
END;
$$;

-- Step 6: Verification queries
-- Check if tables exist
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_name IN ('documents', 'document_chunks');

-- Check if function exists
SELECT proname FROM pg_proc WHERE proname = 'match_user_document_chunks';

-- Check if pgvector extension is enabled
SELECT * FROM pg_extension WHERE extname = 'vector';

-- Success! Your multi-user RAG database is ready (no RLS for service key access).