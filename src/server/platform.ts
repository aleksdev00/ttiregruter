import { getD1Database } from './d1-compat';
import { getPrivateBlobBucket } from './blob-bucket';

const settings = [
  'SHIFT_CODE_WEBHOOK_URL', 'OWNER_EMAIL', 'HQ_TRANSFER_ENABLED', 'HQ_MAPPING_VERIFIED',
  'HQ_PROTOCOL', 'HQ_NOTIFICATION_AUTHORIZED', 'HQ_WEBHOOK_URL', 'HQ_WEBHOOK_SECRET',
  'QUO_WEBHOOK_KEY', 'SUPABASE_URL', 'SUPABASE_PUBLISHABLE_KEY', 'SUPABASE_SERVICE_ROLE_KEY', 'AUTH_SESSION_ENCRYPTION_KEY', 'QUO_WEBHOOK_VERSION', 'QUO_INGEST_ENABLED', 'INVITED_RECRUITER_SETUP_SECRET',
] as const;

export const env = new Proxy({} as Cloudflare.Env, {
  get(_target, key: string | symbol) {
    if (key === 'DB') return getD1Database();
    if (key === 'BUCKET') return getPrivateBlobBucket();
    if (typeof key === 'string' && (settings as readonly string[]).includes(key)) {
      return process.env[key];
    }
    return undefined;
  },
});

