export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
import { env } from '@/src/server/platform';
import { runtime as getSession, failure, json } from '@/src/server/runtime';
import { authorizeDriver, ServiceError } from '@/src/server/access';


async function scope(db: D1Database, actor: Parameters<typeof authorizeDriver>[0], id: string) {
  const driver = await db.prepare('SELECT owner_id,blocked FROM drivers WHERE id=?').bind(id).first<{owner_id:string|null;blocked:number}>();
  authorizeDriver(actor, driver);
}

export async function GET(request: Request) {
  try {
    const { db, actor } = await getSession();
    const params = new URL(request.url).searchParams;
    if (params.has('documentId')) {
      const row = await db.prepare('SELECT * FROM documents WHERE id=?').bind(params.get('documentId')).first<{driver_id:string;object_key:string;mime:string;filename:string}>();
      if (!row) throw new ServiceError('Record not available.', 403, 'not_allowed');
      await scope(db, actor, row.driver_id);
      if (!env.BUCKET) throw new ServiceError('Private document storage is not connected.', 503, 'not_configured');
      const object = await env.BUCKET.get(row.object_key);
      if (!object) throw new ServiceError('Document not available.', 404, 'not_found');
      return new Response(object.body, { headers: {
        'content-type': row.mime,
        'content-disposition': `attachment; filename="${row.filename.replace(/[^\w. -]/g, '_')}"`,
        'cache-control': 'private, no-store',
        'x-content-type-options': 'nosniff',
      } });
    }
    const id = params.get('driverId');
    if (!id) throw new ServiceError('Driver ID required.');
    await scope(db, actor, id);
    return json({ ok: true, value: (await db.prepare('SELECT id,kind,filename,mime,size,created_at FROM documents WHERE driver_id=? ORDER BY created_at DESC').bind(id).all()).results });
  } catch (error) {
    return failure(error);
  }
}
