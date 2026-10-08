// Daily owner-code approval follows the old TTI requestShiftCode contract.
// Only salted hashes are persisted; codes and webhook secrets never leave the server.
type ChatGPTUser={userId:string;email:string;displayName:string;fullName:string|null};
export interface ShiftConfig {HQ_WEBHOOK_URL?:string;HQ_WEBHOOK_SECRET?:string;SHIFT_CODE_WEBHOOK_URL?:string;OWNER_EMAIL?:string}
export function shiftService(db:D1Database,env:ShiftConfig={},fetcher:typeof fetch=fetch){
const getRawDb=()=>db;
const WORK_TIME_ZONE = "Europe/Belgrade";
const CODE_TTL_MS = 15 * 60_000;
const CODE_RESEND_COOLDOWN_MS = 60_000;
const CODE_REQUEST_LEASE_MS = 30_000;
const MAX_CODE_ATTEMPTS = 5;
const DEFAULT_OWNER_EMAIL = "tticdlrecruiting@gmail.com";

type WorkSessionRow = {
  id: string;
  recruiter_user_id: string;
  recruiter_email: string;
  recruiter_name: string | null;
  work_date: string;
  time_zone: string;
  status: "pending_verification" | "active" | "ended";
  started_at: number;
  last_seen_at: number;
  active_seconds: number;
  ended_at: number | null;
  code_hash: string | null;
  code_salt: string | null;
  code_expires_at: number | null;
  code_sent_at: number | null;
  code_request_token: string | null;
  code_request_started_at: number | null;
  verification_attempts: number;
  verified_at: number | null;
  created_at: number;
  updated_at: number;
};

type ShiftCodeRequestResult =
  | { kind: "sent"; session: WorkSessionRow }
  | { kind: "active"; session: WorkSessionRow }
  | { kind: "pending"; session: WorkSessionRow; retryAfterSeconds: number }
  | { kind: "failed"; session: WorkSessionRow; message: string };

function belgradeDateKey(at = Date.now()): string {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: WORK_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(at));
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function publicWorkSession(row: WorkSessionRow | null) {
  if (!row) return null;
  return {
    id: row.id,
    workDate: row.work_date,
    timeZone: row.time_zone,
    status: row.status,
    startedAt: row.started_at,
    lastSeenAt: row.last_seen_at,
    activeSeconds: row.active_seconds,
    endedAt: row.ended_at,
    codeExpiresAt: row.code_expires_at,
    codeSentAt: row.code_sent_at,
    verifiedAt: row.verified_at,
    verificationAttempts: row.verification_attempts,
  };
}

async function getTodaySession(userId: string) {
  return (
    (await getRawDb()
      .prepare(
        "SELECT * FROM work_sessions WHERE recruiter_user_id = ? AND work_date = ? LIMIT 1",
      )
      .bind(userId, belgradeDateKey())
      .first<WorkSessionRow>()) ?? null
  );
}

async function requireActiveWorkSession(userId: string) {
  const session = await getTodaySession(userId);
  return session?.status === "active" ? session : null;
}

async function ensureTodaySession(user: ChatGPTUser) {
  const db = getRawDb();
  const now = Date.now();
  const workDate = belgradeDateKey(now);
  await db
    .prepare(
      `INSERT OR IGNORE INTO work_sessions (
        id, recruiter_user_id, recruiter_email, recruiter_name, work_date,
        time_zone, status, started_at, last_seen_at, active_seconds,
        created_at, updated_at
      ) VALUES (?, ?, ?, ?, ?, ?, 'pending_verification', ?, ?, 0, ?, ?)`,
    )
    .bind(
      crypto.randomUUID(),
      user.userId,
      user.email,
      user.fullName || user.displayName,
      workDate,
      WORK_TIME_ZONE,
      now,
      now,
      now,
      now,
    )
    .run();
  return getTodaySession(user.userId);
}

async function requestShiftCode(
  user: ChatGPTUser,
): Promise<ShiftCodeRequestResult> {
  const db = getRawDb();
  let session = await ensureTodaySession(user);
  if (!session) throw new Error("Dnevna smena nije kreirana.");
  if (session.status === "active") return { kind: "active", session };

  const now = Date.now();
  const cooldownRemaining = session.code_sent_at
    ? CODE_RESEND_COOLDOWN_MS - (now - session.code_sent_at)
    : 0;
  if (cooldownRemaining > 0 && session.code_expires_at && session.code_expires_at > now) {
    return {
      kind: "pending",
      session,
      retryAfterSeconds: Math.ceil(cooldownRemaining / 1000),
    };
  }
  if (
    session.code_request_token &&
    session.code_request_started_at &&
    session.code_request_started_at > now - CODE_REQUEST_LEASE_MS
  ) {
    return { kind: "pending", session, retryAfterSeconds: 5 };
  }

  const code = secureSixDigitCode();
  const salt = crypto.randomUUID();
  const codeHash = await hashCode(salt, code);
  const requestToken = crypto.randomUUID();
  const expiresAt = now + CODE_TTL_MS;
  const claim = await db
    .prepare(
      `UPDATE work_sessions SET
        status = 'pending_verification', ended_at = NULL, code_hash = ?, code_salt = ?,
        code_expires_at = ?, code_request_token = ?, code_request_started_at = ?,
        verification_attempts = 0, updated_at = ?
       WHERE id = ? AND status <> 'active'
         AND (code_request_token IS NULL OR code_request_started_at < ?)
         AND (code_sent_at IS NULL OR code_sent_at < ?)`,
    )
    .bind(
      codeHash,
      salt,
      expiresAt,
      requestToken,
      now,
      now,
      session.id,
      now - CODE_REQUEST_LEASE_MS,
      now - CODE_RESEND_COOLDOWN_MS,
    )
    .run();
  session = (await getTodaySession(user.userId))!;
  if (claim.meta.changes !== 1 || session.code_request_token !== requestToken) {
    return { kind: "pending", session, retryAfterSeconds: 5 };
  }

  const webhookUrl = (env.SHIFT_CODE_WEBHOOK_URL || env.HQ_WEBHOOK_URL)?.trim();
  const webhookSecret = env.HQ_WEBHOOK_SECRET?.trim();
  const ownerEmail = env.OWNER_EMAIL?.trim() || DEFAULT_OWNER_EMAIL;
  if (!webhookUrl || !webhookSecret) {
    const message = "Sending a verification code to the owner is not authorized yet.";
    await clearFailedCodeRequest(session.id, requestToken, message);
    session = (await getTodaySession(user.userId))!;
    return { kind: "failed", session, message };
  }

  try {
    const response = await fetcher(webhookUrl, {
      method: "POST",
      redirect: "follow",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        action: "requestShiftCode",
        webhookSecret,
        idempotencyKey: `shift:${session.id}:${requestToken}`,
        ownerEmail,
        code,
        expiresAtUtc: new Date(expiresAt).toISOString(),
        workDate: session.work_date,
        timeZone: WORK_TIME_ZONE,
        recruiter: {
          userId: user.userId,
          name: user.fullName || user.displayName,
          email: user.email,
        },
      }),
      signal: AbortSignal.timeout(20_000),
    });
    const body = (await response.json().catch(() => null)) as
      | { ok?: boolean; email?: { ok?: boolean }; error?: string }
      | null;
    if (!response.ok || body?.ok !== true || body.email?.ok !== true) {
      throw new Error("Owner code delivery was not confirmed.");
    }
    const sentAt = Date.now();
    await db
      .prepare(
        `UPDATE work_sessions SET code_sent_at = ?, code_request_token = NULL,
          code_request_started_at = NULL, updated_at = ?
         WHERE id = ? AND code_request_token = ?`,
      )
      .bind(sentAt, sentAt, session.id, requestToken)
      .run();
    session = (await getTodaySession(user.userId))!;
    return { kind: "sent", session };
  } catch (error) {
    const message = "Owner code delivery was not confirmed. Check the configured HQ webhook and retry after one minute.";
    await clearFailedCodeRequest(session.id, requestToken, message);
    session = (await getTodaySession(user.userId))!;
    return { kind: "failed", session, message };
  }
}

async function verifyShiftCode(userId: string, code: string) {
  const db = getRawDb();
  let session = await getTodaySession(userId);
  if (!session) return { ok: false as const, reason: "missing" as const, session };
  if (session.status === "active") {
    return { ok: true as const, idempotent: true, session };
  }
  const now = Date.now();
  if (!session.code_sent_at || !session.code_hash || !session.code_salt || !session.code_expires_at) {
    return { ok: false as const, reason: "not_requested" as const, session };
  }
  if (session.code_expires_at < now) {
    return { ok: false as const, reason: "expired" as const, session };
  }
  if (session.verification_attempts >= MAX_CODE_ATTEMPTS) {
    return { ok: false as const, reason: "locked" as const, session };
  }
  const candidateHash = await hashCode(session.code_salt, code);
  if (!timingSafeEqual(session.code_hash, candidateHash)) {
    await db
      .prepare(
        `UPDATE work_sessions SET verification_attempts = verification_attempts + 1,
          updated_at = ? WHERE id = ? AND status<>'active' AND code_hash=? AND verification_attempts<5`,
      )
      .bind(now, session.id, session.code_hash)
      .run();
    session = await getTodaySession(userId);
    return { ok: false as const, reason: "invalid" as const, session };
  }
  await db
    .prepare(
      `UPDATE work_sessions SET
        status = 'active', verified_at = ?, started_at = ?, last_seen_at = ?,
        ended_at = NULL, code_hash = NULL, code_salt = NULL, code_expires_at = NULL,
        code_request_token = NULL, code_request_started_at = NULL,
        verification_attempts = 0, updated_at = ?
       WHERE id = ? AND status <> 'active' AND code_hash=? AND verification_attempts<5 AND code_sent_at IS NOT NULL AND code_expires_at>?`,
    )
    .bind(now, now, now, now, session.id, candidateHash, now)
    .run();
  session = await getTodaySession(userId);
  return session?.status==='active' ? {ok:true as const,idempotent:false,session} : {ok:false as const,reason:'invalid' as const,session};
}

async function heartbeatTodaySession(userId: string) {
  const session = await getTodaySession(userId);
  if (!session || session.status !== "active") return session;
  const now = Date.now();
  const elapsedSeconds = Math.max(0, Math.floor((now - session.last_seen_at) / 1000));
  const deltaSeconds = elapsedSeconds > 120 ? 0 : Math.min(90, elapsedSeconds);
  await getRawDb()
    .prepare(
      `UPDATE work_sessions SET
        active_seconds = active_seconds + ?, last_seen_at = ?, updated_at = ?
       WHERE id = ? AND status = 'active'`,
    )
    .bind(deltaSeconds, now, now, session.id)
    .run();
  return getTodaySession(userId);
}

async function endTodaySession(userId: string) {
  await heartbeatTodaySession(userId);
  const session = await getTodaySession(userId);
  if (!session) return null;
  const now = Date.now();
  const db = getRawDb();
  await db.prepare("UPDATE work_sessions SET status='ended', ended_at=?, code_hash=NULL, code_salt=NULL, code_sent_at=NULL, code_expires_at=NULL, code_request_token=NULL, updated_at=? WHERE id=?").bind(now,now,session.id).run();
  return getTodaySession(userId);
}

async function clearFailedCodeRequest(
  sessionId: string,
  requestToken: string,
  message: string,
) {
  const now = Date.now();
  await getRawDb()
    .prepare(
      `UPDATE work_sessions SET
        code_hash = NULL, code_salt = NULL, code_expires_at = NULL,
        code_request_token = NULL, code_request_started_at = NULL,
        code_sent_at = NULL, updated_at = ?
       WHERE id = ? AND code_request_token = ?`,
    )
    .bind(now, sessionId, requestToken)
    .run();

}

function secureSixDigitCode() {
  const values = new Uint32Array(1);
  crypto.getRandomValues(values);
  return String(100000 + (values[0] % 900000));
}

async function hashCode(salt: string, code: string) {
  const bytes = new TextEncoder().encode(`${salt}:${code}`);
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
}

function timingSafeEqual(left: string, right: string) {
  if (left.length !== right.length) return false;
  let mismatch = 0;
  for (let index = 0; index < left.length; index += 1) {
    mismatch |= left.charCodeAt(index) ^ right.charCodeAt(index);
  }
  return mismatch === 0;
}

return {getTodaySession,requireActiveWorkSession,requestShiftCode,verifyShiftCode,endTodaySession,publicWorkSession,belgradeDateKey};
}
