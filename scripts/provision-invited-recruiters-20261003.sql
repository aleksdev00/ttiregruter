-- One authorized account/assignment batch. Outside schema migrations.
INSERT OR IGNORE INTO recruiters(id,user_id,email,role,active,data_json) VALUES('approved-benedeto',NULL,'d.benedeto@gmail.com','recruiter',1,'{"id":"approved-benedeto","fullName":"","alias":"d.benedeto","referralUrl":null,"callbackNumber":null,"contactEmail":"d.benedeto@gmail.com","reportingTimeZone":"America/Chicago","isDemo":false}');
--> statement-breakpoint
INSERT OR IGNORE INTO recruiters(id,user_id,email,role,active,data_json) VALUES('approved-damgluhovic',NULL,'damgluhovic@gmail.com','recruiter',1,'{"id":"approved-damgluhovic","fullName":"","alias":"damgluhovic","referralUrl":null,"callbackNumber":null,"contactEmail":"damgluhovic@gmail.com","reportingTimeZone":"America/Chicago","isDemo":false}');
--> statement-breakpoint
INSERT OR IGNORE INTO recruiters(id,user_id,email,role,active,data_json) VALUES('approved-marija',NULL,'milojkov.marija2001@gmail.com','recruiter',1,'{"id":"approved-marija","fullName":"","alias":"milojkov.marija2001","referralUrl":null,"callbackNumber":null,"contactEmail":"milojkov.marija2001@gmail.com","reportingTimeZone":"America/Chicago","isDemo":false}');
--> statement-breakpoint
INSERT OR IGNORE INTO recruiters(id,user_id,email,role,active,data_json) VALUES('approved-uros',NULL,'uros.milovanovic1.um@gmail.com','recruiter',1,'{"id":"approved-uros","fullName":"","alias":"uros.milovanovic1.um","referralUrl":null,"callbackNumber":null,"contactEmail":"uros.milovanovic1.um@gmail.com","reportingTimeZone":"America/Chicago","isDemo":false}');
--> statement-breakpoint
INSERT OR IGNORE INTO recruiter_contact_refill(run_id,recruiter_id,email,target,available_before,needed,eligible_pool,created_at)
 SELECT 'invited-recruiters-20261003',r.id,r.email,500,COUNT(d.id),MAX(0,500-COUNT(d.id)),
 (SELECT COUNT(*) FROM drivers d WHERE d.owner_id IS NULL AND d.blocked=0 AND d.duplicate=0 AND d.phone IS NOT NULL
 AND json_extract(d.data_json,'$.phoneNormalized')=d.phone
 AND json_extract(d.data_json,'$.status')='available'
 AND json_extract(d.data_json,'$.activeConversationId') IS NULL
 AND json_extract(d.data_json,'$.reservedBy') IS NULL
 AND json_extract(d.data_json,'$.callbackAt') IS NULL
 AND COALESCE(json_extract(d.data_json,'$.rawFields.contact_blocked'),0)=0
 AND COALESCE(json_extract(d.data_json,'$.rawFields.last_call_outcome'),'')!='do_not_contact'
 AND NOT EXISTS(SELECT 1 FROM quo_line_allocations q WHERE q.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM conversations c WHERE c.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM tasks t WHERE t.driver_id=d.id)),unixepoch()*1000
 FROM recruiters r LEFT JOIN drivers d ON d.owner_id=r.id AND d.blocked=0 AND d.duplicate=0
 AND d.phone IS NOT NULL AND json_extract(d.data_json,'$.status')='available'
 AND json_extract(d.data_json,'$.reservedBy') IS NULL AND json_extract(d.data_json,'$.activeConversationId') IS NULL
 AND json_extract(d.data_json,'$.callbackAt') IS NULL
 WHERE r.active=1 AND lower(r.email) IN ('d.benedeto@gmail.com','damgluhovic@gmail.com','milojkov.marija2001@gmail.com','uros.milovanovic1.um@gmail.com')
 GROUP BY r.id;
--> statement-breakpoint
INSERT OR IGNORE INTO recruiter_contact_refill_backups(run_id,driver_id,recruiter_id,before_json,before_next_action)
 WITH quotas AS (
  SELECT recruiter_id,needed,
   SUM(needed) OVER(ORDER BY email ROWS UNBOUNDED PRECEDING) AS end_index
  FROM recruiter_contact_refill WHERE run_id='invited-recruiters-20261003' AND status='planned'
 ), candidates AS (
  SELECT d.id,d.data_json,d.next_action,ROW_NUMBER() OVER(ORDER BY
    CASE WHEN json_extract(d.data_json,'$.nameEvidence') IN ('explicit_source','driver_confirmed')
    AND json_extract(d.data_json,'$.firstName') IS NOT NULL THEN 0 ELSE 1 END,d.id) AS item_index
  FROM drivers d WHERE d.owner_id IS NULL AND d.blocked=0 AND d.duplicate=0 AND d.phone IS NOT NULL
 AND json_extract(d.data_json,'$.phoneNormalized')=d.phone
 AND json_extract(d.data_json,'$.status')='available'
 AND json_extract(d.data_json,'$.activeConversationId') IS NULL
 AND json_extract(d.data_json,'$.reservedBy') IS NULL
 AND json_extract(d.data_json,'$.callbackAt') IS NULL
 AND COALESCE(json_extract(d.data_json,'$.rawFields.contact_blocked'),0)=0
 AND COALESCE(json_extract(d.data_json,'$.rawFields.last_call_outcome'),'')!='do_not_contact'
 AND NOT EXISTS(SELECT 1 FROM quo_line_allocations q WHERE q.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM conversations c WHERE c.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM tasks t WHERE t.driver_id=d.id)
  ORDER BY CASE WHEN json_extract(d.data_json,'$.nameEvidence') IN ('explicit_source','driver_confirmed')
    AND json_extract(d.data_json,'$.firstName') IS NOT NULL THEN 0 ELSE 1 END,d.id
  LIMIT (SELECT COALESCE(SUM(needed),0) FROM quotas)
 )
 SELECT 'invited-recruiters-20261003',c.id,q.recruiter_id,c.data_json,c.next_action
 FROM candidates c JOIN quotas q ON c.item_index>q.end_index-q.needed AND c.item_index<=q.end_index;
--> statement-breakpoint
UPDATE drivers AS d SET
 owner_id=(SELECT b.recruiter_id FROM recruiter_contact_refill_backups b WHERE b.run_id='invited-recruiters-20261003' AND b.driver_id=d.id),
 data_json=json_set(d.data_json,'$.ownerRecruiterId',(SELECT b.recruiter_id FROM recruiter_contact_refill_backups b WHERE b.run_id='invited-recruiters-20261003' AND b.driver_id=d.id)),
 next_action='Available for assigned recruiter call'
 WHERE d.owner_id IS NULL AND d.blocked=0 AND d.duplicate=0 AND d.phone IS NOT NULL
 AND json_extract(d.data_json,'$.phoneNormalized')=d.phone
 AND json_extract(d.data_json,'$.status')='available'
 AND json_extract(d.data_json,'$.activeConversationId') IS NULL
 AND json_extract(d.data_json,'$.reservedBy') IS NULL
 AND json_extract(d.data_json,'$.callbackAt') IS NULL
 AND COALESCE(json_extract(d.data_json,'$.rawFields.contact_blocked'),0)=0
 AND COALESCE(json_extract(d.data_json,'$.rawFields.last_call_outcome'),'')!='do_not_contact'
 AND NOT EXISTS(SELECT 1 FROM quo_line_allocations q WHERE q.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM conversations c WHERE c.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM applications a WHERE a.driver_id=d.id)
 AND NOT EXISTS(SELECT 1 FROM tasks t WHERE t.driver_id=d.id)
 AND EXISTS(SELECT 1 FROM recruiter_contact_refill_backups b JOIN recruiter_contact_refill r ON r.run_id=b.run_id AND r.recruiter_id=b.recruiter_id
 WHERE b.run_id='invited-recruiters-20261003' AND b.driver_id=d.id AND b.before_json=d.data_json AND r.status='planned');
--> statement-breakpoint
UPDATE recruiter_contact_refill_backups AS b SET applied=1
 WHERE b.run_id='invited-recruiters-20261003' AND EXISTS(SELECT 1 FROM drivers d WHERE d.id=b.driver_id AND d.owner_id=b.recruiter_id
 AND d.data_json=json_set(b.before_json,'$.ownerRecruiterId',b.recruiter_id));
--> statement-breakpoint
UPDATE recruiter_contact_refill AS r SET
 assigned=(SELECT COUNT(*) FROM recruiter_contact_refill_backups b WHERE b.run_id=r.run_id AND b.recruiter_id=r.recruiter_id AND b.applied=1),
 available_after=(SELECT COUNT(*) FROM drivers d WHERE d.owner_id=r.recruiter_id AND d.blocked=0 AND d.duplicate=0 AND d.phone IS NOT NULL
 AND json_extract(d.data_json,'$.status')='available' AND json_extract(d.data_json,'$.activeConversationId') IS NULL
 AND json_extract(d.data_json,'$.reservedBy') IS NULL AND json_extract(d.data_json,'$.callbackAt') IS NULL),
 status='completed'
 WHERE run_id='invited-recruiters-20261003' AND status='planned';
--> statement-breakpoint
INSERT OR IGNORE INTO audit(id,actor_id,type,at,data_json)
 SELECT 'invited-recruiters-20261003:'||recruiter_id,'bootstrap-aleksa','recruiter_contacts_refilled',unixepoch()*1000,
 json_object('target',target,'before',available_before,'assigned',assigned,'after',available_after,'backupTable','recruiter_contact_refill_backups','noExternalActions',1,'existingOutcomesPreserved',1)
 FROM recruiter_contact_refill WHERE run_id='invited-recruiters-20261003';
--> statement-breakpoint
INSERT OR IGNORE INTO audit(id,actor_id,type,at,data_json) VALUES('invited-recruiters-20261003:complete','bootstrap-aleksa','invited_recruiters_provisioned',unixepoch()*1000,'{"approvedEmails":4,"targetContactsEach":500,"noExternalActions":true}');
