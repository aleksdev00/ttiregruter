-- Existing business records and roles are preserved. No passwords or Auth users are created.
BEGIN;
CREATE TABLE IF NOT EXISTS public.recruiter_login_bindings (
 recruiter_id text PRIMARY KEY REFERENCES public.recruiters(id),
 auth_user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id),
 verified_email text NOT NULL UNIQUE,
 must_change bigint NOT NULL DEFAULT 1 CHECK (must_change IN (0,1)),
 updated_at bigint NOT NULL
);
CREATE TABLE IF NOT EXISTS public.recruiter_login_sessions (
 token_hash text PRIMARY KEY,
 recruiter_id text NOT NULL REFERENCES public.recruiters(id),
 auth_user_id uuid NOT NULL REFERENCES auth.users(id),
 email text NOT NULL,
 encrypted_tokens text NOT NULL,
 purpose text NOT NULL CHECK (purpose IN ('login','recovery')),
 created_at bigint NOT NULL,
 expires_at bigint NOT NULL,
 CHECK (expires_at=created_at+CASE WHEN purpose='login' THEN 86400000 ELSE 900000 END)
);
CREATE INDEX IF NOT EXISTS login_sessions_user ON public.recruiter_login_sessions(auth_user_id);
CREATE INDEX IF NOT EXISTS login_sessions_expiry ON public.recruiter_login_sessions(expires_at);
CREATE TABLE IF NOT EXISTS public.recruiter_login_attempts (
 attempt_key text NOT NULL,
 attempted_at bigint NOT NULL
);
CREATE INDEX IF NOT EXISTS login_attempts_key_time ON public.recruiter_login_attempts(attempt_key,attempted_at);
ALTER TABLE public.recruiter_login_bindings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_login_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.recruiter_login_attempts ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.recruiter_login_bindings,public.recruiter_login_sessions,public.recruiter_login_attempts FROM PUBLIC,anon,authenticated;
GRANT ALL ON public.recruiter_login_bindings,public.recruiter_login_sessions,public.recruiter_login_attempts TO service_role;
COMMIT;
