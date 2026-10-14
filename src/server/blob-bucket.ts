import { BlobNotFoundError, del, get, head, list, put } from '@vercel/blob';

function ready() {
  return Boolean(process.env.BLOB_READ_WRITE_TOKEN || (process.env.BLOB_STORE_ID && process.env.VERCEL_OIDC_TOKEN));
}

export function getPrivateBlobBucket(): R2Bucket | undefined {
  if (!ready()) return undefined;
  return {
    async put(key: string, value: string | ArrayBuffer | Blob | ReadableStream<Uint8Array>, options?: R2PutOptions) {
      const result = await put(key, value, {
        access: 'private',
        addRandomSuffix: false,
        allowOverwrite: true,
        contentType: options?.httpMetadata?.contentType,
      });
      return { key, etag: result.etag } as unknown as R2Object;
    },
    async get(key: string, options?: {onlyIf?: {etagMatches?:string}}) {
      const result = await get(key, { access: 'private', useCache: false });
      if (!result || result.statusCode !== 200) return null;
      if(options?.onlyIf?.etagMatches&&options.onlyIf.etagMatches!==result.blob.etag){await result.stream.cancel();return null;}
      const body = result.stream;
      return {
        key,
        size: result.blob.size,
        etag: result.blob.etag,
        body,
        json: async <T>() => await new Response(body).json() as T,
        text: async () => await new Response(body).text(),
        arrayBuffer: async () => await new Response(body).arrayBuffer(),
      } as unknown as R2ObjectBody;
    },
    async list(options?: {limit?:number;cursor?:string;prefix?:string}) {
      const page=await list(options);
      if(page.hasMore&&!page.cursor)throw Error('Blob pagination did not provide a cursor.');
      return {objects:page.blobs.map(b=>({key:b.pathname,size:b.size,etag:b.etag})),truncated:page.hasMore,cursor:page.cursor,delimitedPrefixes:[]};
    },
    async head(key: string) {
      try {
        const result = await head(key);
        return { key, size: result.size, etag: result.etag } as unknown as R2Object;
      } catch (error) {
        if (error instanceof BlobNotFoundError) return null;
        throw error;
      }
    },
    async delete(key: string | string[]) {
      await del(key);
    },
  } as unknown as R2Bucket;
}

type R2PutOptions = { httpMetadata?: { contentType?: string } };

