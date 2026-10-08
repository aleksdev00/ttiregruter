// Generates a reviewable bootstrap SQL file. Never connects to a database.
import fs from 'node:fs/promises';
const target=process.argv[2];if(!target)throw new Error('Provide a destination SQL path; identity JSON is read from stdin.');
let input='';for await(const chunk of process.stdin)input+=chunk;
const p=JSON.parse(input);for(const k of ['userId','email','name','alias','timeZone'])if(typeof p[k]!=='string'||!p[k].trim())throw new Error('Verified '+k+' is required.');
new Intl.DateTimeFormat('en-US',{timeZone:p.timeZone});
const id=crypto.randomUUID();const profile={id,fullName:p.name,alias:p.alias,referralUrl:null,callbackNumber:null,contactEmail:p.email,reportingTimeZone:p.timeZone,isDemo:false};const quote=v=>"'"+v.replaceAll("'","''")+"'";
const sql=`BEGIN;
INSERT INTO store_revision(id,value) VALUES(1,0) ON CONFLICT(id) DO NOTHING;
INSERT INTO recruiters(id,user_id,email,role,active,data_json) VALUES(${quote(id)},${quote(p.userId)},${quote(p.email.toLowerCase())},'owner',1,${quote(JSON.stringify(profile))});
COMMIT;
`;
await fs.writeFile(target,sql,{mode:0o600,flag:'wx'});console.log('Reviewable bootstrap SQL prepared. No database was changed.');
