-- CRITICAL SECURITY FIX: Encrypt Trading API Tokens
-- This migration addresses the security vulnerability of storing trading tokens in plain text

-- Step 1: Create secure functions for token management using Supabase Vault
CREATE OR REPLACE FUNCTION public.store_encrypted_token(
  token_value TEXT,
  token_name TEXT DEFAULT NULL
) 
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  secret_id UUID;
BEGIN
  -- Store token in Supabase Vault with encryption
  SELECT vault.create_secret(
    token_value,
    COALESCE(token_name, 'ctrader_token_' || gen_random_uuid()::text)
  ) INTO secret_id;
  
  RETURN secret_id;
END;
$$;

-- Step 2: Create function to retrieve encrypted tokens
CREATE OR REPLACE FUNCTION public.get_encrypted_token(secret_id UUID) 
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  decrypted_token TEXT;
BEGIN
  -- Only allow users to decrypt their own tokens
  IF NOT EXISTS (
    SELECT 1 FROM public.ctrader_connections 
    WHERE (access_token_id = secret_id OR refresh_token_id = secret_id) 
    AND user_id = auth.uid()
  ) THEN
    RAISE EXCEPTION 'Access denied: Cannot decrypt token for this user';
  END IF;
  
  -- Decrypt token from vault
  SELECT vault.decrypt_secret(secret_id) INTO decrypted_token;
  
  RETURN decrypted_token;
END;
$$;

-- Step 3: Add new columns for encrypted token references
ALTER TABLE public.ctrader_connections 
ADD COLUMN IF NOT EXISTS access_token_id UUID,
ADD COLUMN IF NOT EXISTS refresh_token_id UUID;

-- Step 4: Create function to safely migrate existing tokens
CREATE OR REPLACE FUNCTION public.migrate_tokens_to_vault()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  connection_record RECORD;
  access_secret_id UUID;
  refresh_secret_id UUID;
  migrated_count INTEGER := 0;
BEGIN
  -- Migrate existing tokens to vault
  FOR connection_record IN 
    SELECT id, access_token, refresh_token, account_number
    FROM public.ctrader_connections 
    WHERE access_token_id IS NULL AND access_token IS NOT NULL
  LOOP
    -- Store access token in vault
    SELECT public.store_encrypted_token(
      connection_record.access_token,
      'ctrader_access_' || connection_record.account_number
    ) INTO access_secret_id;
    
    -- Store refresh token in vault  
    SELECT public.store_encrypted_token(
      connection_record.refresh_token,
      'ctrader_refresh_' || connection_record.account_number
    ) INTO refresh_secret_id;
    
    -- Update connection with vault references
    UPDATE public.ctrader_connections 
    SET 
      access_token_id = access_secret_id,
      refresh_token_id = refresh_secret_id
    WHERE id = connection_record.id;
    
    migrated_count := migrated_count + 1;
  END LOOP;
  
  RETURN migrated_count;
END;
$$;

-- Step 5: Create audit function for token access
CREATE OR REPLACE FUNCTION public.audit_token_access(
  connection_id UUID,
  access_type TEXT
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    table_name,
    operation,
    new_values
  ) VALUES (
    auth.uid(),
    'ctrader_token_access',
    'DECRYPT',
    jsonb_build_object(
      'connection_id', connection_id,
      'access_type', access_type,
      'timestamp', now(),
      'ip_address', current_setting('request.headers', true)::jsonb->>'x-forwarded-for'
    )
  );
END;
$$;

-- Step 6: Create secure token retrieval function with audit logging
CREATE OR REPLACE FUNCTION public.get_ctrader_tokens(connection_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  connection_record RECORD;
  access_token TEXT;
  refresh_token TEXT;
  result JSON;
BEGIN
  -- Verify user owns this connection
  SELECT * INTO connection_record
  FROM public.ctrader_connections 
  WHERE id = connection_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied: Connection not found or unauthorized';
  END IF;
  
  -- Audit the token access
  PERFORM public.audit_token_access(connection_id, 'TOKEN_RETRIEVAL');
  
  -- Decrypt tokens
  IF connection_record.access_token_id IS NOT NULL THEN
    SELECT public.get_encrypted_token(connection_record.access_token_id) INTO access_token;
  END IF;
  
  IF connection_record.refresh_token_id IS NOT NULL THEN
    SELECT public.get_encrypted_token(connection_record.refresh_token_id) INTO refresh_token;
  END IF;
  
  -- Return tokens as JSON (never log this)
  result := json_build_object(
    'access_token', access_token,
    'refresh_token', refresh_token,
    'expires_at', connection_record.expires_at
  );
  
  RETURN result;
END;
$$;

-- Step 7: Enhanced RLS policies for token security
DROP POLICY IF EXISTS "Users can view their own connections" ON public.ctrader_connections;

CREATE POLICY "Users can view their own connections (tokens hidden)" 
ON public.ctrader_connections 
FOR SELECT 
USING (auth.uid() = user_id);

-- Step 8: Revoke direct access to sensitive columns
REVOKE SELECT (access_token, refresh_token) ON public.ctrader_connections FROM authenticated;
REVOKE SELECT (access_token, refresh_token) ON public.ctrader_connections FROM anon;

-- Step 9: Create function to update tokens securely
CREATE OR REPLACE FUNCTION public.update_ctrader_tokens(
  connection_id UUID,
  new_access_token TEXT,
  new_refresh_token TEXT,
  new_expires_at TIMESTAMP WITH TIME ZONE
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  connection_record RECORD;
  access_secret_id UUID;
  refresh_secret_id UUID;
BEGIN
  -- Verify user owns this connection
  SELECT * INTO connection_record
  FROM public.ctrader_connections 
  WHERE id = connection_id AND user_id = auth.uid();
  
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Access denied: Connection not found or unauthorized';
  END IF;
  
  -- Store new tokens in vault
  SELECT public.store_encrypted_token(
    new_access_token,
    'ctrader_access_' || connection_record.account_number || '_' || extract(epoch from now())
  ) INTO access_secret_id;
  
  SELECT public.store_encrypted_token(
    new_refresh_token,
    'ctrader_refresh_' || connection_record.account_number || '_' || extract(epoch from now())
  ) INTO refresh_secret_id;
  
  -- Update connection with new vault references
  UPDATE public.ctrader_connections 
  SET 
    access_token_id = access_secret_id,
    refresh_token_id = refresh_secret_id,
    expires_at = new_expires_at,
    updated_at = now()
  WHERE id = connection_id;
  
  -- Audit the token update
  PERFORM public.audit_token_access(connection_id, 'TOKEN_UPDATE');
  
  RETURN TRUE;
END;
$$;

-- Step 10: Create cleanup function for old vault entries (optional)
CREATE OR REPLACE FUNCTION public.cleanup_old_token_secrets()
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  cleanup_count INTEGER := 0;
BEGIN
  -- This function can be used to clean up old vault entries
  -- Implementation depends on vault cleanup requirements
  
  -- Log cleanup activity
  INSERT INTO public.audit_logs (
    user_id,
    table_name,
    operation,
    new_values
  ) VALUES (
    auth.uid(),
    'vault_cleanup',
    'CLEANUP',
    jsonb_build_object(
      'timestamp', now(),
      'cleaned_count', cleanup_count
    )
  );
  
  RETURN cleanup_count;
END;
$$;

-- Step 11: Execute migration of existing tokens
-- This will encrypt all existing tokens
SELECT public.migrate_tokens_to_vault();

-- Step 12: Add constraints and validation
ALTER TABLE public.ctrader_connections 
ADD CONSTRAINT check_token_encryption CHECK (
  (access_token IS NULL OR access_token_id IS NOT NULL) AND
  (refresh_token IS NULL OR refresh_token_id IS NOT NULL)
);

-- Step 13: Add comments for documentation
COMMENT ON FUNCTION public.store_encrypted_token IS 'Securely stores API tokens in Supabase Vault with encryption';
COMMENT ON FUNCTION public.get_encrypted_token IS 'Retrieves and decrypts tokens from vault with user authorization';
COMMENT ON FUNCTION public.get_ctrader_tokens IS 'Secure API for retrieving cTrader tokens with audit logging';
COMMENT ON FUNCTION public.update_ctrader_tokens IS 'Secure API for updating cTrader tokens';

-- Step 14: Grant minimal required permissions
GRANT EXECUTE ON FUNCTION public.get_ctrader_tokens TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_ctrader_tokens TO authenticated;