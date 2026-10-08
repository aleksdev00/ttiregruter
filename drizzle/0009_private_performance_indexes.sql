CREATE INDEX IF NOT EXISTS private_perf_drivers_owner ON drivers(owner_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS private_perf_conversations_owner_status ON conversations(recruiter_id,status,driver_id);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS private_perf_audit_driver_type ON audit(driver_id,type);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS private_perf_audit_actor_type_driver ON audit(actor_id,type,driver_id);
