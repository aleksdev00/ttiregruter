declare namespace Cloudflare {
  interface Env {
    DB?: D1Database;
    SHIFT_CODE_WEBHOOK_URL?:string;
    OWNER_EMAIL?:string;
    HQ_TRANSFER_ENABLED?: string;
    HQ_MAPPING_VERIFIED?: string;
    HQ_PROTOCOL?: string;
    HQ_NOTIFICATION_AUTHORIZED?: string;
    HQ_WEBHOOK_URL?: string;
    HQ_WEBHOOK_SECRET?: string;
    QUO_WEBHOOK_KEY?: string;
    QUO_WEBHOOK_VERSION?: string;
    QUO_INGEST_ENABLED?: string;
    BUCKET?: R2Bucket;
  }
}
