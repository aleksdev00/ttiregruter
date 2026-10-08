export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { handleUpload, type HandleUploadBody } from '@vercel/blob/client';
import { head } from '@vercel/blob';
import { z } from 'zod';
import { env } from '@/src/server/platform';
import { runtime as getSession } from '@/src/server/runtime';
import { authorizeDriver, ServiceError } from '@/src/server/access';
import { currentRevision, guardedBatch } from '@/src/server/store';


const uploadInfo = z.object({
  id: z.string().uuid(),
  driverId: z.string().min(1).max(200),
  kind: z.enum(['application', 'cdl', 'medical', 'other']),
  filename: z.string().trim().min(1).max(120),
  mime: z.enum(['application/pdf', 'image/jpeg', 'image/png']),
}).strict();

export async function POST(request: Request) {
  try {
    if (!env.DB || !env.BUCKET) throw new ServiceError('Private database and file storage must be connected.', 503, 'not_configured');
    const body = await request.json() as HandleUploadBody;
    let uploadActor: Awaited<ReturnType<typeof getSession>>['actor'] | null = null;

    if (body.type === 'blob.generate-client-token') {
      const origin = request.headers.get('origin');
      if (!origin || origin !== new URL(request.url).origin) throw new ServiceError('Same-origin request required.', 403, 'not_allowed');
      const session = await getSession();
      uploadActor = session.actor;
    }

    const result = await handleUpload({
      request,
      body,
      onBeforeGenerateToken: async (pathname, clientPayload) => {
        if (!uploadActor || !clientPayload) throw new ServiceError('Sign in again before uploading.', 401, 'not_allowed');
        const info = uploadInfo.parse(JSON.parse(clientPayload));
        if (pathname !== `documents/${info.id}`) throw new ServiceError('Invalid document upload path.');
        const driver = await env.DB!.prepare('SELECT owner_id,blocked FROM drivers WHERE id=?').bind(info.driverId).first<{owner_id:string|null;blocked:number}>();
        authorizeDriver(uploadActor, driver);
        return {
          allowedContentTypes: [info.mime],
          maximumSizeInBytes: 10_000_000,
          addRandomSuffix: false,
          allowOverwrite: false,
          tokenPayload: JSON.stringify({ ...info, actorId: uploadActor.id }),
        };
      },
      onUploadCompleted: async ({ blob, tokenPayload }) => {
        if (!tokenPayload || !env.DB) throw new ServiceError('Upload confirmation is missing.');
        const payload = uploadInfo.extend({ actorId: z.string().min(1) }).strict().parse(JSON.parse(tokenPayload));
        const stored = await head(blob.url);
        if (blob.pathname !== `documents/${payload.id}` || blob.contentType !== payload.mime || stored.size > 10_000_000) {
          throw new ServiceError('Uploaded document did not match its signed details.');
        }
        const db = env.DB;
        const actorRow = await db.prepare('SELECT id,user_id,email,role,data_json FROM recruiters WHERE id=? AND active=1').bind(payload.actorId).first<{id:string;user_id:string|null;email:string;role:'owner'|'admin'|'recruiter';data_json:string}>();
        if (!actorRow) throw new ServiceError('Recruiter access changed before upload completed.', 403, 'not_allowed');
        const actor = { id: actorRow.id, userId: actorRow.user_id ?? actorRow.id, email: actorRow.email, role: actorRow.role, profile: JSON.parse(actorRow.data_json) };
        const driver = await db.prepare('SELECT owner_id,blocked FROM drivers WHERE id=?').bind(payload.driverId).first<{owner_id:string|null;blocked:number}>();
        authorizeDriver(actor, driver);
        if (await db.prepare('SELECT id FROM documents WHERE id=?').bind(payload.id).first()) return;
        const revision = await currentRevision(db);
        await guardedBatch(db, revision, [
          db.prepare('INSERT INTO documents(id,driver_id,kind,filename,mime,size,object_key,actor_id,created_at) VALUES(?,?,?,?,?,?,?,?,?)')
            .bind(payload.id, payload.driverId, payload.kind, payload.filename.replace(/[^\w. -]/g, '_'), payload.mime, stored.size, blob.pathname, actor.id, Date.now()),
          db.prepare('INSERT INTO audit(id,actor_id,driver_id,type,at,data_json) VALUES(?,?,?,\'document_saved\',?,?)')
            .bind(crypto.randomUUID(), actor.id, payload.driverId, Date.now(), JSON.stringify({ documentId: payload.id, kind: payload.kind })),
        ]);
      },
    });
    return Response.json(result, { headers: { 'cache-control': 'private, no-store' } });
  } catch (error) {
    const known = error instanceof ServiceError;
    return Response.json({ ok: false, message: known ? error.message : 'The upload could not be confirmed. Reload the document list before retrying.' }, { status: known ? error.status : 400, headers: { 'cache-control': 'private, no-store' } });
  }
}
