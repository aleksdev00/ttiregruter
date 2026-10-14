import {ServiceError} from '../access.ts';
const encoder=new TextEncoder();
export function crc32(bytes:Uint8Array,previous=0){let crc=(previous^0xffffffff)>>>0;for(const byte of bytes){crc^=byte;for(let i=0;i<8;i++)crc=(crc>>>1)^((crc&1)?0xedb88320:0);}return (crc^0xffffffff)>>>0;}
function header(length:number,values:[number,number,number][]){const b=new Uint8Array(length),v=new DataView(b.buffer);for(const [offset,size,value] of values)if(size===2)v.setUint16(offset,value,true);else v.setUint32(offset,value,true);return b;}
export type ArchiveEntry={key:string;size:number;etag:string};
export async function* zipEntries(entries:ArchiveEntry[],read:(entry:ArchiveEntry)=>Promise<ReadableStream<Uint8Array>>){
 let offset=0;const central:Uint8Array[]=[];
 for(const entry of entries){
  const name=encoder.encode(entry.key);
  if(name.length>65535||entry.key.split('/').some(p=>p==='..')||entry.key.startsWith('/')||entry.key.includes('\\'))throw Error('Unsafe archive object key.');
  const start=offset;
  const local=header(30,[[0,4,0x04034b50],[4,2,20],[6,2,0x808],[26,2,name.length]]);
  yield local;yield name;offset+=local.length+name.length;
  const reader=(await read(entry)).getReader();let crc=0,size=0;
  try{while(true){const chunk=await reader.read();if(chunk.done)break;crc=crc32(chunk.value,crc);size+=chunk.value.length;offset+=chunk.value.length;yield chunk.value;}}finally{await reader.cancel();reader.releaseLock();}
  if(size!==entry.size)throw Error('Object size changed during export.');
  const descriptor=header(16,[[0,4,0x08074b50],[4,4,crc],[8,4,size],[12,4,size]]);yield descriptor;offset+=16;
  const c=header(46,[[0,4,0x02014b50],[4,2,20],[6,2,20],[8,2,0x808],[16,4,crc],[20,4,size],[24,4,size],[28,2,name.length],[42,4,start]]);
  central.push(c,name);
 }
 const start=offset;for(const b of central){yield b;offset+=b.length;}
 yield header(22,[[0,4,0x06054b50],[8,2,entries.length],[10,2,entries.length],[12,4,offset-start],[16,4,start]]);
}
export async function bucketArchive(bucket:R2Bucket){
 const entries:ArchiveEntry[]=[];let cursor:string|undefined,total=0;
 do{
  const page=await bucket.list({limit:1000,cursor});
  for(const object of page.objects){entries.push({key:object.key,size:object.size,etag:object.etag});total+=object.size+encoder.encode(object.key).length*2+100;}
  if(entries.length>65000||total>0xffffffff-1024*1024)throw new ServiceError('The complete file archive exceeds standard ZIP limits. A separate R2 export is required; no partial archive was started.',413,'export_too_large');
  cursor=page.truncated?page.cursor:undefined;
 }while(cursor);
 const manifest=encoder.encode(JSON.stringify({exportedAt:new Date().toISOString(),scope:'All listed R2 objects; original keys preserved. Changed or missing objects abort the download.',objects:entries},null,2));
 const manifestEntry={key:'_TTI-export-manifest-'+crypto.randomUUID()+'.json',size:manifest.length,etag:''};
 const iterator=zipEntries([...entries,manifestEntry],async entry=>{
  if(entry===manifestEntry)return new ReadableStream({start(c){c.enqueue(manifest);c.close();}});
  const object=await bucket.get(entry.key,{onlyIf:{etagMatches:entry.etag}});
  if(!object||!('body' in object))throw Error('An R2 object changed or disappeared. Retry the complete archive.');
  return object.body;
 });
 return new ReadableStream<Uint8Array>({async pull(c){try{const step=await iterator.next();if(step.done)c.close();else c.enqueue(step.value);}catch(e){c.error(e);}},async cancel(){await iterator.return(undefined);}});
}
