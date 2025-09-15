-- Supabase RPC function for user-specific document chunk matching
-- Run this SQL in your Supabase dashboard

CREATE OR REPLACE FUNCTION match_user_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_filter uuid
)
RETURNS TABLE (
  id text,
  document_id text,
  user_id uuid,
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
    document_chunks.user_id,
    document_chunks.content,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE 
    document_chunks.user_id = user_id_filter
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;

-- Alternative function if you need to filter by document IDs as well
CREATE OR REPLACE FUNCTION match_user_document_chunks_filtered (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_filter uuid,
  document_ids_filter text[] DEFAULT NULL
)
RETURNS TABLE (
  id text,
  document_id text,
  user_id uuid,
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
    document_chunks.user_id,
    document_chunks.content,
    document_chunks.metadata,
    1 - (document_chunks.embedding <=> query_embedding) AS similarity
  FROM document_chunks
  WHERE 
    document_chunks.user_id = user_id_filter
    AND (
      document_ids_filter IS NULL 
      OR document_chunks.document_id = ANY(document_ids_filter)
    )
    AND 1 - (document_chunks.embedding <=> query_embedding) > match_threshold
  ORDER BY document_chunks.embedding <=> query_embedding
  LIMIT match_count;
END;
$$;