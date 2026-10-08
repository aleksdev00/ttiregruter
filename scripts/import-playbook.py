from pathlib import Path
import re,json,hashlib
root=Path(__file__).resolve().parents[1]
source=(root/'src/content/playbook/source.md').read_text()
section_matches=list(re.finditer(r'^## (\d+)\. (.+)$',source,re.M))
sections=[{'number':int(m[1]),'title':m[2],'rawSource':source[m.start():(section_matches[i+1].start() if i+1<len(section_matches) else len(source))]} for i,m in enumerate(section_matches)]
scenarios=[]
for section in sections:
 matches=list(re.finditer(r'^### (S\d{3}) — (.+)$',section['rawSource'],re.M))
 for i,m in enumerate(matches):
  rest=section['rawSource'][m.end():(matches[i+1].start() if i+1<len(matches) else len(section['rawSource']))]
  rest=re.split(r'^### (?!S\d{3})',rest,flags=re.M)[0]
  nxt=re.search(r'^\*\*Next:\*\* (.+(?:\n(?!#).*)*)',rest,re.M)
  coach=nxt[1].strip() if nxt else ''
  before=rest[:nxt.start()] if nxt else rest
  say=re.search(r'\*\*Say:\*\* (.+)',before)
  subject=re.search(r'\*\*Subject:\*\* (.+)',before)
  body=say[1] if say else re.sub(r'^\*\*Subject:\*\* .+\n','',before,flags=re.M).strip()
  num=int(m[1][1:]); channel='operational' if num in (150,155) else 'email' if num==156 else 'voicemail' if 147<=num<=149 else 'text' if 151<=num<=154 else 'spoken'
  action='suppress' if num in (13,155) else 'wrong_number' if num==5 else 'callback' if num in (7,8,9,10) else 'decline' if num==12 else 'w2' if num in (29,33) else '1099' if num in (30,34) else 'verification' if num==169 else 'review'
  paths=['w2'] if num in (29,33) else ['1099'] if num in (30,34) else ['w2','1099','undecided']
  required=sorted(set(re.findall(r'\[([^\]]+)\]',body+(subject[1] if subject else ''))))
  references=sorted(set(re.findall(r'\bS\d{3}\b',rest)))
  keywords=[m[2].lower(),section['title'].lower()]+({'S003':['where did you get my number','number source','indeed'],'S061':['pay guarantee','guaranteed pay'],'S074':['home every weekend','weekly home time'],'S120':['link not working','broken link'],'S013':['stop calling','do not contact','dnc'],'S155':['stop texting','opt out'],'S169':['unknown question','no answer prepared']}.get(m[1],[]))
  scenarios.append({'id':m[1],'title':m[2],'section':section['number'],'category':section['title'],'canonicalSpoken':body,'coach':coach,'subject':subject[1] if subject else None,'rawSource':section['rawSource'][m.start():m.end()]+rest,'sourceReference':f'source.md#{m[1]}','internalReferences':references,'metadata':{'channel':channel,'actionType':action,'employmentPaths':paths,'keywords':keywords,'requiredContext':required,'relatedQuestionIds':(['opening'] if num<=16 else ['priority','non_negotiables'] if num<=28 else ['employment'] if num<=38 else ['qualification_blocked'] if num<=56 else ['offer'] if num<=115 else ['w2_handoff','application'] if num<=146 else [])}})
ids=[x['id'] for x in scenarios]
assert len(ids)==172 and len(set(ids))==172 and set(ids)=={f'S{i:03}' for i in range(1,173)}
assert all(x['canonicalSpoken'] and x['coach'] for x in scenarios)
assert all(r in ids for x in scenarios for r in x['internalReferences'])
data={'version':'2026-09-30-playbook-v1','sourceSha256':hashlib.sha256(source.encode()).hexdigest(),'sections':sections,'scenarios':scenarios}
(root/'src/content/playbook/data.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n')
print(f'PASS: {len(sections)} sections; {len(ids)} unique scenarios; canonical source retained; references valid.')
