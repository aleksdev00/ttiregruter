"""Read-only XLSX import preview. Never contacts a server or imports records."""
import argparse,collections,datetime,decimal,hashlib,json,posixpath,re,unicodedata,zipfile
from pathlib import Path
import xml.etree.ElementTree as E
NS={'s':'http://schemas.openxmlformats.org/spreadsheetml/2006/main'}
MAPPINGS={'JUN':{'name':'A','phone':'B','recruiter':'C','company':'D','notes':'E','position':'F'},'JUL':{'name':'A','phone':'B','recruiter':'C','company':'D','notes':'E','position':'F'},'AVGUST':{'name':'A','phone':'B','recruiter':'C','company':'D','notes':'E','position':'F'},'SEPTEMBAR':{'name':'A','phone':'B','recruiter':'C','company':'D','notes':'E','position':'F'},'ODOBRENI':{'name':'B','phone':'C','recruiter':'D','company':'E','notes':'G','position':'F'}}
def normalized(value):return ' '.join(unicodedata.normalize('NFKC',value).strip().casefold().split())
def phone(raw):
 try:
  if re.fullmatch(r'\d+(\.\d+)?([eE][+-]?\d+)?',raw):raw=format(decimal.Decimal(raw),'f').split('.')[0]
 except decimal.InvalidOperation:return None
 digits=re.sub(r'\D','',raw)
 if len(digits)==10:return '+1'+digits
 if len(digits)==11 and digits.startswith('1'):return '+'+digits
 return None

def read(path):
 z=zipfile.ZipFile(path);strings=[''.join(t.itertext()) for t in E.fromstring(z.read('xl/sharedStrings.xml')).findall('s:si',NS)] if 'xl/sharedStrings.xml' in z.namelist() else []
 rels={r.attrib['Id']:r.attrib['Target'] for r in E.fromstring(z.read('xl/_rels/workbook.xml.rels'))};sheets=[]
 for s in E.fromstring(z.read('xl/workbook.xml')).findall('s:sheets/s:sheet',NS):
  target=rels[s.attrib['{http://schemas.openxmlformats.org/officeDocument/2006/relationships}id']];part=target.lstrip('/') if target.startswith('/') else posixpath.normpath('xl/'+target);rows=[]
  for row in E.fromstring(z.read(part)).findall('s:sheetData/s:row',NS):
   cells={}
   for c in row.findall('s:c',NS):
    v=c.find('s:v',NS);value=v.text if v is not None else '';kind=c.attrib.get('t','n');formula=c.find('s:f',NS)
    if kind=='s':value=strings[int(value)] if value else ''
    elif kind=='inlineStr':value=''.join(c.find('s:is',NS).itertext())
    if value or formula is not None:cells[re.sub(r'\d','',c.attrib['r'])]={'value':value,'kind':kind,'formula':formula.text if formula is not None else None,'ref':c.attrib['r']}
   if cells:rows.append({'row':int(row.attrib['r']),'cells':cells})
  sheets.append({'sheet':s.attrib['name'],'rows':rows})
 return sheets

def preview(path,output):
 sheets=read(path);records=[];dates=[];summary={};aliases={'recruiter':{},'company':{}};index=collections.defaultdict(list)
 for s in sheets:
  if s['sheet'] not in MAPPINGS:continue
  mapping=MAPPINGS[s['sheet']];candidate=0
  for row in s['rows']:
   cells=row['cells'];v=lambda key:cells.get(mapping[key],{}).get('value','');name=v('name');raw=v('phone');n=phone(raw);flags=[]
   if not raw and len(cells)==1 and 'A' in cells:
    raw_date=cells['A']['value'];parsed=None
    try:parsed=(datetime.datetime(1899,12,30)+datetime.timedelta(days=float(raw_date))).date().isoformat()
    except (ValueError,OverflowError):pass
    flag=[]
    if s['sheet']=='JUL' and row['row']==41:flag.append('JUL_A41_DATE_ANOMALY')
    if not parsed:flag.append('date_requires_review')
    dates.append({'sheet':s['sheet'],'row':row['row'],'raw':raw_date,'candidateDate':parsed,'flags':flag});continue
   if row['row']==1 and normalized(name) in ['vozac','vozač']:continue
   if not name and not raw:continue
   candidate+=1
   if not n:flags.append('phone_requires_review')
   if cells.get(mapping['phone'],{}).get('formula'):flags.append('phone_formula_requires_review')
   if cells.get(mapping['phone'],{}).get('kind')=='n':flags.append('numeric_phone_preserve_original')
   if not name.strip():flags.append('missing_name')
   for k in aliases:
    source=v(k);key=normalized(source)
    if key:aliases[k].setdefault(key,set()).add(source)
   source={'sheet':s['sheet'],'row':row['row']};record={'source':source,'sourceKey':hashlib.sha256((str(path.name)+':'+s['sheet']+':'+str(row['row'])).encode()).hexdigest(),'originalCells':cells,'candidateIdentity':{'name':name,'phone':n},'recruiterAlias':normalized(v('recruiter')),'companyAlias':normalized(v('company')),'position':v('position'),'originalNotes':v('notes'),'stage':'needs_review','ownerId':None,'flags':flags,'importEligible':False}
   if s['sheet']=='ODOBRENI':flags.append('sheet_name_does_not_confirm_approval_or_start')
   if v('notes'):flags.append('historical_status_requires_review')
   records.append(record)
   if n:index[n].append(record)
  summary[s['sheet']]={'nonemptyRows':len(s['rows']),'candidateBusinessRows':candidate,'mapping':mapping}
 for repeats in index.values():
  if len(repeats)>1:
   names={normalized(r['candidateIdentity']['name']) for r in repeats}
   for record in repeats:record['flags'].append('repeated_identity_preserve_application_history');record['flags']+=['conflicting_names_requires_review'] if len(names)>1 else []
 output.mkdir(parents=True,exist_ok=True)
 private={'sourceSha256':hashlib.sha256(path.read_bytes()).hexdigest(),'records':records,'dateMarkers':dates,'aliases':{k:{alias:sorted(values) for alias,values in v.items()} for k,v in aliases.items()},'automaticImportEnabled':False}
 (output/'historical-preview.private.json').write_text(json.dumps(private,ensure_ascii=False,indent=2))
 public={'sourceSha256':private['sourceSha256'],'sheets':summary,'candidateRows':len(records),'normalizedIdentities':len(index),'repeatGroups':sum(len(v)>1 for v in index.values()),'invalidPhones':sum(r['candidateIdentity']['phone'] is None for r in records),'dateMarkers':len(dates),'JUL_A41':next((d for d in dates if d['sheet']=='JUL' and d['row']==41),None),'flags':dict(collections.Counter(f for r in records for f in r['flags'])),'allRowsRequireReview':True,'automaticImportEnabled':False}
 (output/'historical-preview-summary.json').write_text(json.dumps(public,ensure_ascii=False,indent=2));return public
if __name__=='__main__':
 p=argparse.ArgumentParser();p.add_argument('workbook',type=Path);p.add_argument('--output',type=Path,required=True);args=p.parse_args();print(json.dumps(preview(args.workbook,args.output),ensure_ascii=False,indent=2))
