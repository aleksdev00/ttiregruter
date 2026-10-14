import {SESSION_MS,sessionValid} from '../security-policy.ts';
import {ServiceError} from '../access.ts';
const encoder=new TextEncoder();
export {SESSION_MS,sessionValid};
function b64(v:Uint8Array){return Buffer.from(v).toString('base64url');}
function bytes(v:string){return new Uint8Array(Buffer.from(v,'base64url'));}
export async function tokenHash(v:string){return b64(new Uint8Array(await crypto.subtle.digest('SHA-256',encoder.encode(v))));}
export function opaqueToken(){return b64(crypto.getRandomValues(new Uint8Array(32)));}
async function key(secret:string){const raw=bytes(secret);if(raw.length!==32)throw new ServiceError('Configure a 32-byte AUTH_SESSION_ENCRYPTION_KEY on the server.',503,'not_configured');return crypto.subtle.importKey('raw',raw,{name:'AES-GCM'},false,['encrypt','decrypt']);}
export async function encryptTokens(secret:string,value:TokenPair){const iv=crypto.getRandomValues(new Uint8Array(12)),cipher=await crypto.subtle.encrypt({name:'AES-GCM',iv},await key(secret),encoder.encode(JSON.stringify(value)));return b64(iv)+'.'+b64(new Uint8Array(cipher));}
export async function decryptTokens(secret:string,value:string):Promise<TokenPair>{const [iv,cipher]=value.split('.');const plain=await crypto.subtle.decrypt({name:'AES-GCM',iv:bytes(iv)},await key(secret),bytes(cipher));const p=JSON.parse(new TextDecoder().decode(plain));if(typeof p.access_token!=='string'||typeof p.refresh_token!=='string'||!Number.isFinite(p.expires_at))throw Error('Invalid encrypted session');return p;}
export type TokenPair={access_token:string;refresh_token:string;expires_at:number};
export function validatePassword(value:string){if(value.length<8||value.length>128)throw new ServiceError('Use a password between 8 and 128 characters.');}
