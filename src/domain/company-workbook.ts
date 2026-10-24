import {unzipSync,type UnzipFileInfo} from 'fflate';

export type WorkbookOfferDraft={
 id:string; sheet:string; name:string; existing:boolean; sourceTerms:string;
 summary:string; schedule:string; equipment:string; program:'company'|'lease'|'owner_operator'|'unknown'; employment:'w2'|'1099'|'lease'|'owner_operator'|'unknown';
 payUnit:'cpm'|'weekly'|'hourly'|'percentage'|'unknown'; payMin:number|null; payMax:number|null; sap:'no_history'|'completed_only'|'consider'|'unknown';
};
export type WorkbookSheet={name:string;rows:string[][]};

const utf8=new TextDecoder();
const xml=(files:Record<string,Uint8Array>,name:string)=>{const value=files[name];if(!value)throw new Error(`The workbook is missing ${name}.`);const doc=new DOMParser().parseFromString(utf8.decode(value),'application/xml');if(doc.querySelector('parsererror'))throw new Error(`The workbook contains invalid XML in ${name}.`);return doc;};
const text=(node:Element|null)=>node?.textContent?.trim()??'';
function columnIndex(ref:string){const letters=ref.replace(/\d/g,'').toUpperCase();let n=0;for(const char of letters)n=n*26+char.charCodeAt(0)-64;return n-1;}
function resolveTarget(target:string){if(target.startsWith('/'))return target.slice(1);const stack=['xl'];for(const part of target.split('/')){if(!part||part==='.')continue;if(part==='..')stack.pop();else stack.push(part);}return stack.join('/');}
export function parseXlsx(buffer:ArrayBuffer):WorkbookSheet[]{
 if(buffer.byteLength>12*1024*1024)throw new Error('The Excel file is over the 12 MB limit.');
 const input=new Uint8Array(buffer);if(input.length<4||input[0]!==0x50||input[1]!==0x4b)throw new Error('Choose an .xlsx workbook (Excel 2007 or newer).');
 let expanded=0,entries=0;
 const files=unzipSync(input,{filter:(file:UnzipFileInfo)=>{entries++;if(entries>250)throw new Error('The workbook has too many internal files.');if(!file.name.toLowerCase().endsWith('.xml'))return false;expanded+=file.originalSize;if(file.originalSize>8*1024*1024||expanded>24*1024*1024)throw new Error('The workbook expands beyond the safe 24 MB limit.');return true;}});
 const workbook=xml(files,'xl/workbook.xml'),relations=xml(files,'xl/_rels/workbook.xml.rels');
 const relMap=new Map(Array.from(relations.getElementsByTagName('Relationship')).map(node=>[node.getAttribute('Id')??'',node.getAttribute('Target')??'']));
 const sharedFile=files['xl/sharedStrings.xml'];let strings:string[]=[];
 if(sharedFile){const doc=xml(files,'xl/sharedStrings.xml');strings=Array.from(doc.getElementsByTagName('si')).map(si=>Array.from(si.getElementsByTagName('t')).map(t=>t.textContent??'').join(''));}
 const sheetNodes=Array.from(workbook.getElementsByTagName('sheet'));if(!sheetNodes.length)throw new Error('No worksheets were found.');if(sheetNodes.length>80)throw new Error('The workbook has more than 80 worksheets.');
 let totalRows=0,totalCells=0;
 return sheetNodes.map(sheet=>{
  const name=sheet.getAttribute('name')??'Sheet';const rel=sheet.getAttribute('r:id')??'';const target=relMap.get(rel);if(!target)throw new Error(`Worksheet ${name} is not linked correctly.`);
  const part=resolveTarget(target),doc=xml(files,part),rows:string[][]=[];
  for(const row of Array.from(doc.getElementsByTagName('row'))){totalRows++;if(totalRows>12000)throw new Error('The workbook has more than 12,000 rows.');const cells=Array.from(row.getElementsByTagName('c'));const values:string[]=[];
   for(const cell of cells){totalCells++;if(totalCells>60000)throw new Error('The workbook has more than 60,000 cells.');const col=columnIndex(cell.getAttribute('r')??'A1');if(col<0||col>80)continue;let value=text(cell.getElementsByTagName('v')[0]??null);const kind=cell.getAttribute('t');if(kind==='s'){const idx=Number(value);value=Number.isInteger(idx)?strings[idx]??'':'';}else if(kind==='inlineStr')value=Array.from(cell.getElementsByTagName('t')).map(t=>t.textContent??'').join('');if(value)values[col]=value;}
   rows.push(values);
  }
  return {name,rows};
 });
}

const norm=(s:string)=>s.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,' ').trim();
const genericSheet=/^(companies|company list|carriers|carrier list|offers|opportunities|notes|readme|instructions|summary|sheet\s*\d+)$/i;
const companyLabel=/^(company|company name|carrier|carrier name|employer)$/i;
const tableLabels=/^(company|company name|carrier|carrier name|employer|pay|rate|employment|program|position|state|states|route|schedule|home time|trailer|truck|equipment|status)$/i;
const scheduleLabel=/home time|home-time|schedule|days out|route|regional|local|otr/i;
const equipmentLabel=/equipment|truck|tractor|trailer|duties/i;
const payLabel=/pay|compensation|cpm|rate|percentage|gross/i;
function parseMoney(textValue:string){const values=[...textValue.matchAll(/\$?\s*(\d+(?:\.\d+)?)\s*(?:cpm|per mile|\/mi|\/mile|per week|weekly|per hour|\/hr|\/hour)?/gi)].map(m=>Number(m[1])).filter(Number.isFinite);return {min:values.length?Math.min(...values):null,max:values.length?Math.max(...values):null};}
function rowsToRecords(sheet:WorkbookSheet){
 const nonempty=sheet.rows.map(row=>row.map(v=>(v??'').trim()));
 const headerIndex=nonempty.slice(0,12).findIndex(row=>row.filter(cell=>tableLabels.test(norm(cell))).length>=2&&row.some(cell=>companyLabel.test(norm(cell))));
 if(headerIndex>=0){const headers=nonempty[headerIndex].map(norm);const col=headers.findIndex(companyLabel.test.bind(companyLabel));return nonempty.slice(headerIndex+1).flatMap(row=>{const name=row[col]?.trim();if(!name)return[];return [{name,lines:headers.flatMap((label,i)=>row[i]? [`${nonempty[headerIndex][i]}: ${row[i]}`]:[])}];});}
 const lines=nonempty.flatMap(row=>{const values=row.filter(Boolean);if(!values.length)return[];if(values.length===1)return [values[0]];return [`${values[0]}: ${values.slice(1).join(' · ')}`];});
 const nameRow=nonempty.find(row=>companyLabel.test(norm(row[0]??''))&&row.slice(1).some(Boolean));
 const name=nameRow?.slice(1).find(Boolean)?.trim()||sheet.name.trim();
 if(!name||genericSheet.test(name))return[];
 return [{name,lines}];
}
export function buildWorkbookOfferDrafts(sheets:WorkbookSheet[],existingNames:string[]):WorkbookOfferDraft[]{
 const existing=new Set(existingNames.map(norm));const grouped=new Map<string,{name:string;sheet:string;lines:string[]}>();
 for(const sheet of sheets){for(const record of rowsToRecords(sheet)){
  const key=norm(record.name);if(!key)continue;const prior=grouped.get(key);if(prior){prior.lines.push(...record.lines);if(!prior.sheet.split(', ').includes(sheet.name))prior.sheet+=`, ${sheet.name}`;}else grouped.set(key,{name:record.name,sheet:sheet.name,lines:[...record.lines]});
 }}
 const result:WorkbookOfferDraft[]=[];
 for(const record of grouped.values()){
  const lines=[...new Set(record.lines.map(line=>line.trim()).filter(Boolean))];const full=lines.join('\n').slice(0,8000);if(!full)continue;
  const schedule=lines.filter(line=>scheduleLabel.test(line)).join('\n').slice(0,8000)||'Needs verification.';
  const equipment=lines.filter(line=>equipmentLabel.test(line)).join('\n').slice(0,8000)||'Needs verification.';
  const payText=lines.filter(line=>payLabel.test(line)).join('\n');const lowered=(lines.join(' ')+' '+record.name).toLowerCase();
  const programText=lines.find(line=>/program|employment|driver type|position/i.test(line))??'';let program:WorkbookOfferDraft['program']='unknown',employment:WorkbookOfferDraft['employment']='unknown';
  if(/owner[ -]?operator/i.test(programText)){program='owner_operator';employment='owner_operator';}else if(/lease/i.test(programText)){program='lease';employment='lease';}else if(/1099/i.test(programText)){program='company';employment='1099';}else if(/w[ -]?2/i.test(programText)){program='company';employment='w2';}
  if(program==='unknown'){if(/owner[ -]?operator/i.test(lowered)){program='owner_operator';employment='owner_operator';}else if(/\blease\b/i.test(lowered)){program='lease';employment='lease';}else if(/\b1099\b/i.test(lowered)){program='company';employment='1099';}else if(/\bw[ -]?2\b/i.test(lowered)){program='company';employment='w2';}}
  const sap:WorkbookOfferDraft['sap']=/no sap|no sap history|does not accept sap/i.test(lowered)?'no_history':/completed sap|completed rtd|completed.*return to duty/i.test(lowered)?'completed_only':/consider sap|sap.*consider/i.test(lowered)?'consider':'unknown';
  const money=parseMoney(payText);let payUnit:WorkbookOfferDraft['payUnit']='unknown';if(/cpm|per mile|\/mi|\/mile/i.test(payText))payUnit='cpm';else if(/per week|weekly/i.test(payText))payUnit='weekly';else if(/per hour|\/hr|\/hour/i.test(payText))payUnit='hourly';else if(/percentage|\%|percent|gross/i.test(payText))payUnit='percentage';
  result.push({id:crypto.randomUUID(),sheet:record.sheet,name:record.name,existing:existing.has(norm(record.name)),sourceTerms:full,summary:full,schedule,equipment,program,employment,payUnit,payMin:money.min,payMax:money.max,sap});
 }
 return result;
}
