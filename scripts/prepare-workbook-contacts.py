"""Read owner-supplied Kontakti worksheets and create private import segments.
No spreadsheet or database is modified. Unverified names and ambiguous identities
are retained in the private review file rather than guessed or merged.
"""
import openpyxl,json,re,collections,pathlib,hashlib,datetime,os,sys
root=pathlib.Path(sys.argv[1]);out=pathlib.Path(sys.argv[2]);out.mkdir(parents=True,exist_ok=True)
files=['TTI_Leads_Contacts_Analysis.xlsx','Leadovi2026_Contacts_Analysis.xlsx']
groups=collections.defaultdict(list);bad=[];counts={};hashes={}
def norm(v):
 d=re.sub(r'\D','',str(v or ''))
 if len(d)==10:d='1'+d
 return '+'+d if len(d)==11 and d.startswith('1') else None
def safe_name(v):
 n=str(v or '').strip();n=re.sub(r'\s+',' ',n)
 if not n or len(n)>100 or re.search(r'[\d@]',n) or any(not(c.isalpha() or c in " '’.-") for c in n):return None
 if re.search(r'^(starts?|available|availability|asap|not interested|no answer|do not contact|unknown|not recorded|dry van|reefer|flatbed|owner operator|lease purchase|company driver|clean record|manual|automatic|otr|regional|local|cdl|sap)$',n,re.I):return None
 if re.search(r'^(starts?\s+|(?:in|next|within|after)\s+).*\b(days?|weeks?|months?)\b',n,re.I):return None
 return n
def canonical(n):return re.sub(r'[^\w ]','',n.casefold()).strip()
def compatible(names):
 if not names:return True
 longest=max(names,key=lambda n:len(n.split()));tokens=canonical(longest).split()
 return all((t:=canonical(n).split())==tokens[:len(t)] for n in names)
for fn in files:
 hashes[fn]=hashlib.sha256((root/fn).read_bytes()).hexdigest();w=openpyxl.load_workbook(root/fn,read_only=True,data_only=True);it=w['Kontakti'].iter_rows(values_only=True);headers=list(next(it));count=0
 for rowno,vals in enumerate(it,2):
  if not any(v is not None for v in vals):continue
  count+=1;record={'file':fn,'file_sha256':hashes[fn],'sheet':'Kontakti','row':rowno,'fields':dict(zip(headers,vals))}
  p=norm(vals[1]) or norm(vals[2]);name=safe_name(vals[0]);record['reliable_name']=name
  emails=sorted(set(re.findall(r'[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}',str(vals[3] or ''),re.I)));record['emails']=emails
  if not p:bad.append(record);continue
  groups[p].append(record)
 counts[fn]=count
review=[];contacts=[];email_phones=collections.defaultdict(set)
for p,rs in groups.items():
 for r in rs:
  for e in r['emails']:email_phones[e.lower()].add(p)
shared_emails={e:ps for e,ps in email_phones.items() if len(ps)>1}
for p,rs in sorted(groups.items()):
 names={r['reliable_name'] for r in rs if r['reliable_name']}
 if not compatible(names):review.append({'phone':p,'reason':'Different reliable names share a phone','records':rs});continue
 name=max(names,key=lambda n:len(n.split())) if names else None
 emails=sorted({e.lower() for r in rs for e in r['emails']})
 # A shared mailbox is not sufficient proof that two different phone records
 # are the same person. Hold these groups for review instead of duplicating.
 if any(e in shared_emails for e in emails):review.append({'phone':p,'reason':'Email occurs with multiple phones; identity needs review','records':rs});continue
 first,last=(name.split(' ',1)+[None])[:2] if name else (None,None)
 rawphone=next((r['fields'].get('Telefon u izvoru') for r in rs if r['fields'].get('Telefon u izvoru')),p)
 block='\n'.join(str(r['fields'].get('Podaci iz bloka') or '') for r in rs).strip()
 blocked=bool(re.search(r'\b(do not contact|do not call|dnc|opt[ -]?out|unsubscribe)\b',block,re.I))
 contacts.append({'id':'workbook-phone-'+hashlib.sha256(p.encode()).hexdigest()[:24],'phone_e164':p,'original_phone':str(rawphone),'first_name':first,'last_name':last,'email':emails[0] if len(emails)==1 else None,'source':'Owner-provided contact workbooks · Kontakti','source_reference':'; '.join(sorted({r['file'] for r in rs})),'source_records_json':json.dumps(rs,ensure_ascii=False,default=str),'notes':block or None,'lead_status':'do_not_contact' if blocked else 'needs_review','contact_blocked':1 if blocked else 0,'next_step':'Owner review: confirm recruiter ownership and current disposition before calling. Workbook has no verified assignment or call history.'})
now=datetime.datetime.now(datetime.timezone.utc).isoformat().replace('+00:00','Z');paths=[]
review_payload={'summary':{'inputRows':sum(counts.values()),'invalidPhoneRows':len(bad),'ambiguousGroups':len(review),'duplicatePhoneRowsRemoved':sum(len(rs)-1 for rs in groups.values()),'uniquePhoneGroups':len(groups),'contactsPrepared':len(contacts)},'records':[{'reason':'Invalid or missing US phone','record_json':json.dumps(r,ensure_ascii=False,default=str)} for r in bad]+[{'reason':r['reason'],'record_json':json.dumps(r,ensure_ascii=False,default=str)} for r in review]}
def save(path,value):
 path.write_text(json.dumps(value,ensure_ascii=False,default=str),encoding='utf8');os.chmod(path,0o600)
for i in range(0,len(contacts),1000):
 path=out/('contacts-%03d.json'%(i//1000+1));manifest={'schemaVersion':1,'sourceProjectId':'owner-contact-workbooks','extractedAt':now,'driver_profiles':contacts[i:i+1000],'owner_operator_contacts':[],'recruiters':[],'contact_batches':[],'contact_batch_items':[]};
 if i==0:manifest['review']=review_payload
 save(path,manifest);paths.append(str(path))
save(out/'identity-review.json',{'invalid_phone_rows':bad,'ambiguous_groups':review})
summary={'files':counts,'input_rows':sum(counts.values()),'invalid_phone_rows':len(bad),'valid_phone_rows':sum(len(rs) for rs in groups.values()),'unique_phone_groups':len(groups),'duplicate_phone_rows_removed':sum(len(rs)-1 for rs in groups.values()),'ambiguous_groups_held':len(review),'contacts_prepared':len(contacts),'with_reliable_name':sum(bool(c['first_name'] or c['last_name']) for c in contacts),'without_reliable_name':sum(not(c['first_name'] or c['last_name']) for c in contacts),'restricted':sum(c['contact_blocked'] for c in contacts),'unresolved_ownership':len(contacts),'parts':len(paths),'manifest_paths':paths,'source_sha256':hashes}
save(out/'summary.json',summary);print(json.dumps({k:v for k,v in summary.items() if k not in ['manifest_paths','source_sha256']},ensure_ascii=False))
