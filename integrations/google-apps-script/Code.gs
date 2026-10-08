// Prepared bridge. Configure and verify a mapping before enabling; no email is sent.
// MAPPING_JSON: {spreadsheetId,hq:{tab,headerRow,startRow,columns:{applicationId,driverId,name,email,phone,company,stage,fingerprint}},crm:{...},headers:{hq:{field:actualHeader},crm:{field:actualHeader}}}
function doPost(e) {
 const lock=LockService.getScriptLock();let hq=null;
 try {
  const props=PropertiesService.getScriptProperties(),p=JSON.parse(e.postData.contents);
  if(!props.getProperty('WEBHOOK_SECRET')||p.secret!==props.getProperty('WEBHOOK_SECRET'))throw Error('Unauthorized.');
  if(props.getProperty('TRANSFER_ENABLED')!=='true')throw Error('Transfer not activated.');
  const config=JSON.parse(props.getProperty('MAPPING_JSON')||'null');
  if(!config||props.getProperty('MAPPING_VERIFIED')!=='true')throw Error('Mapping must be verified before writing.');
  if(!p.applicationId||!p.driverId)throw Error('Stable application and driver IDs required.');
  lock.waitLock(25000);
  const book=SpreadsheetApp.openById(config.spreadsheetId);
  const hs=verifyMapping_(book,config.hq,config.headers.hq),cs=verifyMapping_(book,config.crm,config.headers.crm);
  // Both tab/header mappings are checked before either business write.
  const fingerprint=Utilities.base64Encode(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,JSON.stringify({driverId:p.driverId,offer:p.offer,termsVersion:p.termsVersion})));
  const d=p.driver||{},values={applicationId:p.applicationId,driverId:p.driverId,name:[d.firstName,d.lastName].filter(Boolean).join(' '),email:d.email||'',phone:d.phoneNormalized||'',company:p.offer.companyName,stage:'internally_finalized',fingerprint:fingerprint};
  hq=upsert_(hs,config.hq,values);const crm=upsert_(cs,config.crm,values);
  return json_({ok:true,hq:hq,crm:crm,notification:{status:'disabled'}});
 }catch(error){return json_({ok:false,hq:hq,crm:{ok:false},notification:{status:'disabled'},error:String(error.message)});}finally{if(lock.hasLock())lock.releaseLock();}
}
function verifyMapping_(book,mapping,headers){if(new Set(Object.values(mapping.columns)).size!==Object.values(mapping.columns).length)throw Error('Column mapping must be distinct.');const s=book.getSheetByName(mapping.tab);if(!s)throw Error('Configured tab missing.');['applicationId','driverId','name','email','phone','company','stage','fingerprint'].forEach(function(k){const col=mapping.columns[k];if(!Number.isInteger(col)||col<1||!headers[k]||s.getRange(mapping.headerRow,col).getDisplayValue()!==headers[k])throw Error('Header mapping mismatch: '+k);});return s;}
function occupied_(values,formulas,columns){return values.some(function(value,i){const identity=i===columns.applicationId-1||i===columns.driverId-1;return (identity||!formulas[i])&&value!==''&&value!==null&&typeof value!=='boolean';});}
function upsert_(sheet,m,values){const width=sheet.getLastColumn(),count=sheet.getMaxRows()-m.startRow+1;if(count<1)throw Error('Invalid data start row.');const cells=sheet.getRange(m.startRow,1,count,width).getValues(),formulas=sheet.getRange(m.startRow,1,count,width).getFormulas();let row=0,empty=0;cells.forEach(function(v,i){if(String(v[m.columns.applicationId-1])===values.applicationId){if(row)throw Error('Duplicate application ID requires review.');row=m.startRow+i;}if(!empty&&!occupied_(v,formulas[i],m.columns))empty=m.startRow+i;});if(!row){row=empty||sheet.getMaxRows()+1;if(row>sheet.getMaxRows()){sheet.insertRowsAfter(sheet.getMaxRows(),1);const source=sheet.getRange(row-1,1,1,width),target=sheet.getRange(row,1,1,width);source.copyTo(target,SpreadsheetApp.CopyPasteType.PASTE_FORMAT,false);source.copyTo(target,SpreadsheetApp.CopyPasteType.PASTE_DATA_VALIDATION,false);source.getFormulasR1C1()[0].forEach(function(f,i){if(f&&!Object.keys(m.columns).some(function(k){return m.columns[k]===i+1;}))sheet.getRange(row,i+1).setFormulaR1C1(f);});}}const prior=String(sheet.getRange(row,m.columns.fingerprint).getValue()||'');if(prior&&prior!==values.fingerprint)throw Error('Application fingerprint conflict.');const driver=String(sheet.getRange(row,m.columns.driverId).getValue()||'');if(driver&&driver!==values.driverId)throw Error('Driver identity conflict.');sheet.getRange(row,m.columns.applicationId).setValue(values.applicationId);SpreadsheetApp.flush();Object.keys(m.columns).forEach(function(k){if(values[k]!==undefined&&(!prior||sheet.getRange(row,m.columns[k]).getValue()===''))sheet.getRange(row,m.columns[k]).setValue(safeCell_(values[k]));});SpreadsheetApp.flush();if(String(sheet.getRange(row,m.columns.applicationId).getValue())!==values.applicationId||String(sheet.getRange(row,m.columns.driverId).getValue())!==values.driverId)throw Error('Identity readback failed.');return {ok:true,recordId:values.applicationId,rowNumber:row};}
function safeCell_(value){return typeof value==='string'&&/^\s*[=+@-]/.test(value)?"'"+value:value;}
function json_(value){return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
