CREATE TABLE IF NOT EXISTS recruiter_contact_refill (
 run_id TEXT NOT NULL, recruiter_id TEXT NOT NULL, email TEXT NOT NULL,
 target INTEGER NOT NULL, available_before INTEGER NOT NULL, needed INTEGER NOT NULL,
 eligible_pool INTEGER NOT NULL, assigned INTEGER NOT NULL DEFAULT 0,
 available_after INTEGER, status TEXT NOT NULL DEFAULT 'planned', created_at INTEGER NOT NULL,
 PRIMARY KEY(run_id,recruiter_id)
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS recruiter_contact_refill_backups (
 run_id TEXT NOT NULL, driver_id TEXT NOT NULL, recruiter_id TEXT NOT NULL,
 before_json TEXT NOT NULL, before_next_action TEXT NOT NULL,
 applied INTEGER NOT NULL DEFAULT 0, PRIMARY KEY(run_id,driver_id)
);