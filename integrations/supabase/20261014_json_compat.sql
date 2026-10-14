-- Private implementation detail of the server-side PostgreSQL adapter.
BEGIN;
CREATE SCHEMA IF NOT EXISTS tti_private;
REVOKE ALL ON SCHEMA tti_private FROM PUBLIC,anon,authenticated;
GRANT USAGE ON SCHEMA tti_private TO service_role;
CREATE OR REPLACE FUNCTION tti_private.json_set(document jsonb, path text[], value jsonb)
RETURNS jsonb LANGUAGE plpgsql IMMUTABLE SECURITY INVOKER
SET search_path = pg_catalog,tti_private AS $$
DECLARE first_key text; nested jsonb;
BEGIN
 IF array_length(path,1) IS NULL THEN RETURN value; END IF;
 IF jsonb_typeof(document) <> 'object' OR document IS NULL THEN document := '{}'::jsonb; END IF;
 first_key := path[1];
 IF array_length(path,1)=1 THEN RETURN jsonb_set(document,path,COALESCE(value,'null'::jsonb),true); END IF;
 nested := tti_private.json_set(document->first_key,path[2:array_length(path,1)],value);
 RETURN jsonb_set(document,ARRAY[first_key],nested,true);
END $$;
REVOKE ALL ON FUNCTION tti_private.json_set(jsonb,text[],jsonb) FROM PUBLIC,anon,authenticated;
GRANT EXECUTE ON FUNCTION tti_private.json_set(jsonb,text[],jsonb) TO service_role;
COMMIT;
