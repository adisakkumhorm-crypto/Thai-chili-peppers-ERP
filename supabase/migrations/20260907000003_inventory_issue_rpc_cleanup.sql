-- Drop the UUID version of the function to resolve ambiguity
DROP FUNCTION IF EXISTS public.rpc_issue_stock(UUID, TEXT, INT, UUID, UUID, UUID, UUID, TEXT, UUID);
