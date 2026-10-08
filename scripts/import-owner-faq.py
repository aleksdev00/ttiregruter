import re,json,hashlib
from pathlib import Path
root=Path(__file__).resolve().parents[1]
s=(root/'src/content/owner-faq/source.md').read_text()
categories=[];entries=[]
for n,title,body in re.findall(r'## (\d+)\. ([^\n]+)\n(.*?)(?=\n## |\Z)',s,re.S):
    categories.append({'id':int(n),'title':title})
    for question,answer in re.findall(r'\*\*Q: (.*?)\*\*\s*\*\*A:\*\* “(.*?)”',body,re.S):
        entries.append({'id':f'F{len(entries)+1:03}','category':int(n),'question':question,'answer':answer})
for i,(title,answer) in enumerate(re.findall(r'\*\*(If .*?):\*\*\s*“(.*?)”',s,re.S),1):
    entries.append({'id':f'C{i:03}','category':0,'question':title,'answer':answer})
assert len(categories)==8 and len(entries)==86,(len(categories),len(entries))
(root/'src/content/owner-faq/data.json').write_text(json.dumps({'sourceSha256':hashlib.sha256(s.encode()).hexdigest(),'categories':categories,'entries':entries},ensure_ascii=False,indent=2)+'\n')
