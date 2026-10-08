import type {Recruiter} from '../contracts/index.ts';
export interface Actor {id:string;userId:string;email:string;role:'owner'|'admin'|'recruiter';profile:Recruiter}
export class ServiceError extends Error {status:number;code:string;constructor(message:string,status=400,code='invalid_input'){super(message);this.status=status;this.code=code;}}
export const isAdmin=(a:Actor)=>a.role==='owner'||a.role==='admin';
export function requireAdmin(a:Actor){if(!isAdmin(a))throw new ServiceError('Administrator access required.',403,'not_allowed');}
export function authorizeDriver(a:Actor,d:{owner_id:string|null;blocked:number}|null,contact=false){if(!d||(!isAdmin(a)&&d.owner_id!==a.id))throw new ServiceError('This record is not available. Request assignment from an administrator.',403,'not_allowed');if(contact&&d.blocked)throw new ServiceError('Do Not Contact: contact and forwarding are suppressed.',409,'not_allowed');return d;}
export function normalizePhone(raw:string):string|null{const n=raw.replace(/[^\d+]/g,'');const digits=n.replace(/\D/g,'');if(digits.length===10)return '+1'+digits;if(digits.length===11&&digits.startsWith('1'))return '+'+digits;return /^\+[1-9]\d{7,14}$/.test(n)?n:null;}
type BootstrapAccount={id:string;email:string;role:Actor['role'];fullName:string;alias:string};
// Explicitly approved application accounts. Platform account UUIDs are not
// Site-scoped authentication IDs: bind only the dispatcher-authenticated user.
export const bootstrapAccounts:BootstrapAccount[]=[
 {id:'bootstrap-aleksa',email:'cvetanovicaleksa45@gmail.com',role:'admin',fullName:'Aleksa Cvetanović',alias:'Alex Jones'},
 {id:'approved-nate',email:'mikicn956@gmail.com',role:'recruiter',fullName:'Nemanja Mikic',alias:'Nate Mitchell'},
 {id:'approved-john',email:'lakikiller09@gmail.com',role:'recruiter',fullName:'Lazar Jevtic',alias:'John'},
 {id:'approved-nash',email:'azzinjo86@gmail.com',role:'recruiter',fullName:'Aleksandar Djordjevic',alias:'Nash'},
 {id:'approved-jacob',email:'jovanmill03@gmail.com',role:'recruiter',fullName:'Jovan Miladinovic',alias:'Jacob'},
 {id:'approved-mike',email:'belopoljacmihailo@gmail.com',role:'recruiter',fullName:'',alias:'Mike'},
 {id:'approved-stephan',email:'grujic.stefan114@gmail.com',role:'recruiter',fullName:'',alias:'Stephan'},
 {id:'approved-samuel',email:'thesilentflame2@gmail.com',role:'recruiter',fullName:'',alias:'Samuel'},
 {id:'approved-mila',email:'vuskovic.mila17@gmail.com',role:'recruiter',fullName:'',alias:'Mila'},
 {id:'approved-benedeto',email:'d.benedeto@gmail.com',role:'recruiter',fullName:'',alias:'d.benedeto'},
 {id:'approved-damgluhovic',email:'damgluhovic@gmail.com',role:'recruiter',fullName:'',alias:'damgluhovic'},
 {id:'approved-marija',email:'milojkov.marija2001@gmail.com',role:'recruiter',fullName:'',alias:'milojkov.marija2001'},
 {id:'approved-uros',email:'uros.milovanovic1.um@gmail.com',role:'recruiter',fullName:'',alias:'uros.milovanovic1.um'},
 {id:'bootstrap-tti-owner',email:'tticdlrecruiting@gmail.com',role:'owner',fullName:'TTI Recruiting',alias:'TTI Recruiting'},
];
function bootstrapProfile(account:BootstrapAccount,id:string):Recruiter{return {id,fullName:account.fullName,alias:account.alias,referralUrl:null,callbackNumber:null,contactEmail:account.email,reportingTimeZone:'America/Chicago',isDemo:false};}
async function ensureBootstrap(db:D1Database,user:{userId:string;email:string}){
 const account=bootstrapAccounts.find(item=>item.email===user.email.toLowerCase());
 const email=user.email.toLowerCase();
 const approved=await db.prepare('SELECT id FROM recruiters WHERE lower(email)=? AND active=1').bind(email).first();
 if(!account&&!approved)return;
 const existing=await db.prepare('SELECT id FROM recruiters LIMIT 1').first<{id:string}>();
 const writes:D1PreparedStatement[]=[];
 if(!existing&&account){
  writes.push(db.prepare('INSERT INTO store_revision(id,value) VALUES(1,0) ON CONFLICT(id) DO NOTHING'));
  for(const item of bootstrapAccounts)writes.push(db.prepare('INSERT OR IGNORE INTO recruiters(id,user_id,email,role,active,data_json) VALUES(?,NULL,?,?,1,?)').bind(item.id,item.email,item.role,JSON.stringify(bootstrapProfile(item,item.id))));
 }
 // Claim an approved email, preserving its existing recruiter ID and all ownership.
 // Login cannot create roles, reactivate accounts, or replace an identity binding.
 writes.push(db.prepare('UPDATE recruiters SET user_id=? WHERE lower(email)=? AND active=1 AND user_id IS NULL AND (SELECT COUNT(*) FROM recruiters WHERE lower(email)=?)=1 AND NOT EXISTS(SELECT 1 FROM recruiters WHERE user_id=?)').bind(user.userId,email,email,user.userId));
 await db.batch(writes);
}
export async function resolveActor(db:D1Database,user:{userId:string;email:string}|null):Promise<Actor>{if(!user)throw new ServiceError('Sign in with ChatGPT to continue.',401,'not_allowed');await ensureBootstrap(db,user);const r=await db.prepare('SELECT * FROM recruiters WHERE user_id=? AND lower(email)=? AND active=1').bind(user.userId,user.email.toLowerCase()).first<{id:string;user_id:string;email:string;role:Actor['role'];data_json:string}>();if(!r)throw new ServiceError('Your recruiter account must be approved and linked by the administrator.',403,'not_allowed');return {id:r.id,userId:r.user_id,email:r.email,role:r.role,profile:JSON.parse(r.data_json)};}
