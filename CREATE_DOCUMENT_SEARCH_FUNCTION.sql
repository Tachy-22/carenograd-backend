-- Drop existing function first
DROP FUNCTION IF EXISTS match_user_document_chunks(vector, float, int, uuid);

-- Create the RPC function for user-specific document chunk matching
CREATE OR REPLACE FUNCTION match_user_document_chunks (
  query_embedding vector(1536),
  match_threshold float,
  match_count int,
  user_id_filter uuid
)
RETURNS TABLE (
  id uuid,
  document_id uuid,
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

-- Grant permissions
GRANT EXECUTE ON FUNCTION match_user_document_chunks(vector, float, int, uuid) TO anon;
GRANT EXECUTE ON FUNCTION match_user_document_chunks(vector, float, int, uuid) TO authenticated;