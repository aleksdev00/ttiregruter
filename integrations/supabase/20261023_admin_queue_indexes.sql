-- Add indexes required by the unassigned-contact count and eligibility checks.
-- The partial driver index avoids reparsing every large driver JSON record.
CREATE INDEX IF NOT EXISTS applications_driver
  ON public.applications (driver_id);

CREATE INDEX IF NOT EXISTS tasks_driver_status
  ON public.tasks (driver_id, status);

CREATE INDEX IF NOT EXISTS tti_available_unassigned_queue
  ON public.drivers (id)
  WHERE owner_id IS NULL
    AND blocked = 0
    AND duplicate = 0
    AND phone IS NOT NULL
    AND (data_json::jsonb ->> 'status') = 'available'
    AND COALESCE((data_json::jsonb ->> 'isDemo')::boolean, false) = false
    AND (data_json::jsonb ->> 'activeConversationId') IS NULL;
