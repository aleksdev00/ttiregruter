/** Additive handler for the existing legacy webhook. No spreadsheet/application writes.
 * In the EXISTING doPost, immediately after verifyWebhookSecret_(payload.webhookSecret):
 *   if (isConversationCompletionAction_(payload.action)) return conversationCompletion_(payload);
 * Keep all existing actions and properties unchanged. Update the existing deployment version.
 */
function isConversationCompletionAction_(action) {
  return ['conversationCompletionCapabilities','completeConversation','conversationCompletionStatus'].indexOf(action) >= 0;
}
function conversationJson_(value) {return ContentService.createTextOutput(JSON.stringify(value)).setMimeType(ContentService.MimeType.JSON);}
function conversationCanonical_(v) {
  if (v === null || typeof v !== 'object') return JSON.stringify(v);
  if (Array.isArray(v)) return '['+v.map(conversationCanonical_).join(',')+']';
  return '{'+Object.keys(v).sort().map(function(k){return JSON.stringify(k)+':'+conversationCanonical_(v[k]);}).join(',')+'}';
}
function conversationDigest_(s) {return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,s,Utilities.Charset.UTF_8).map(function(b){return ('0'+((b+256)%256).toString(16)).slice(-2);}).join('');}
function companyFinderValue_(filters,key,labels) {
  const value=filters&&filters[key];
  if (!value) return 'Not specified in Company Finder';
  return labels[value]||String(value);
}
function conversationCompletion_(p) {
  const properties=PropertiesService.getScriptProperties();
  if (!properties.getProperty('WEBHOOK_SECRET') || p.webhookSecret !== properties.getProperty('WEBHOOK_SECRET')) return conversationJson_({ok:false,error:'Unauthorized.'});
  if (p.action==='conversationCompletionCapabilities') return conversationJson_({ok:true,conversationCompletion:{version:1,receiptStatus:true,deduplicated:true}});
  const id=String(p.notificationId||'');
  if (!/^conversation:[-\w:.]{1,200}$/.test(id)) return conversationJson_({ok:false,error:'Invalid notification ID.'});
  const response=function(status,ok,safe){return conversationJson_({ok:status==='sent'||status==='not_found',notificationId:id,email:{ok:ok,status:status,safeToRetry:safe===true}});};
  const lock=LockService.getScriptLock();
  if (!lock.tryLock(20000)) return response('unconfirmed',false,false);
  try {
    const key='CONVERSATION_MAIL_'+conversationDigest_(id),raw=properties.getProperty(key),prior=raw?JSON.parse(raw):null;
    if (p.action==='conversationCompletionStatus') return prior?response(prior.status==='sending'?'unconfirmed':prior.status,prior.status==='sent',prior.status==='failed'):response('not_found',false,true);
    const c=p.completion,hash=c?conversationDigest_(conversationCanonical_(c)):null;
    if (prior && prior.hash!==hash) return response('unconfirmed',false,false);
    if (prior && ['sent','sending','unconfirmed'].indexOf(prior.status)>=0) return response(prior.status==='sending'?'unconfirmed':prior.status,prior.status==='sent',false);
    // All validation, body construction, and quota checks happen before the durable send reservation.
    const allowed=['no_answer','callback','not_interested','interested','driver_reports_applied','wrong_number','do_not_contact','no_current_fit','w2_routed','qualification_in_progress','company_chosen','application_received','pending_verification','handoff_required'];
    if (!c || c.notificationId!==id || id!=='conversation:'+c.conversationId || !c.completedAtUtc || !Number.isFinite(Date.parse(c.completedAtUtc)) || allowed.indexOf(c.outcome)<0 || !c.recruiter || !c.recruiter.verifiedEmail || !c.driver) return response('failed',false,true);
    let body;
    try {
      body='Internal conversation completion notification\nThis records a finished conversation. It does not establish an application submission, accepted driver, or placement.\n\n'+
        'Conversation ID: '+c.conversationId+'\nNotification ID: '+id+'\nCompleted UTC: '+c.completedAtUtc+'\nOutcome: '+c.outcome+'\nVoicemail: '+c.voicemailStatus+'\nCallback UTC: '+(c.callbackAt||'Not agreed')+'\nReporting timezone: '+(c.callbackTimeZone||'Unknown')+'\n\n'+
        'Recruiter real name: '+(c.recruiter.realName||'Not recorded')+'\nAlias: '+(c.recruiter.alias||'Not recorded')+'\nVerified email: '+c.recruiter.verifiedEmail+'\n\n'+
        'Recorded driver name: '+(c.driver.recordedName||'Not recorded')+'\nPhone: '+(c.driver.phone||'Not recorded')+'\nEmail: '+(c.driver.email||'Not recorded')+'\nRecorded state: '+(c.driver.recordedState||'Not recorded')+'\n\n'+
        'Company Finder driver filters used for matching:\n'+
        'Position Type: '+companyFinderValue_(c.companyFinder&&c.companyFinder.filters,'position',{'Company driver':'Company driver','Lease':'Lease','Owner-operator':'Owner-operator'})+'\n'+
        '1099 / W-2: '+companyFinderValue_(c.companyFinder&&c.companyFinder.filters,'employmentType',{'W-2':'W-2','1099':'1099','Either':'Either'})+'\n'+
        'Home time: '+companyFinderValue_(c.companyFinder&&c.companyFinder.filters,'home',{'1':'Daily','7':'Weekly','14':'2 weeks','flexible':'Flexible'})+'\n'+
        'Trailer type: '+companyFinderValue_(c.companyFinder&&c.companyFinder.filters,'trailer',{'Dry van':'Dry van','Reefer':'Reefer','Flatbed':'Flatbed'})+'\n'+
        'CDL-A experience: '+companyFinderValue_(c.companyFinder&&c.companyFinder.filters,'experienceMonths',{'0-6':'0–6 months','6-12':'6–12 months','12-24':'1–2 years','24+':'2+ years'})+'\n'+
        'SAP status: '+companyFinderValue_(c.companyFinder&&c.companyFinder.filters,'sap',{'no':'No SAP','needsrtd':'SAP; RTD needed','completed':'RTD completed','unknown':'SAP status unknown'})+'\n'+
        'Company Finder choice: '+(c.companyFinder?(c.companyFinder.selectedCompany||'No company selected')+' · '+(c.companyFinder.selectedProgram||'Program not recorded'):'No Company Finder selection recorded')+'\n'+
        'Company Finder fit status: '+(c.companyFinder&&c.companyFinder.fitStatus||'Not recorded')+'\n'+
        'Company Finder verification needed: '+(c.companyFinder&&c.companyFinder.fitVerificationNeeded&&c.companyFinder.fitVerificationNeeded.length?c.companyFinder.fitVerificationNeeded.join('; '):'None recorded')+'\n\n'+
        'Other driver information and answers (unknown/null fields are unconfirmed):\n'+JSON.stringify(c.confirmedInformation,null,2)+'\n\nQualification answers and confirmation status:\n'+JSON.stringify(c.qualification,null,2)+'\n\nRecruiter notes at completion:\n'+JSON.stringify(c.notes,null,2)+'\n\n'+
        'Selected company/program and recorded verification status:\n'+(c.selectedCompany?JSON.stringify(c.selectedCompany,null,2):'None selected')+'\n\nSeparate external application evidence, if recorded:\n'+JSON.stringify(c.applicationEvidence,null,2);
      if (MailApp.getRemainingDailyQuota()<1) return response('failed',false,true);
    } catch(error) {return response('failed',false,true);}
    properties.setProperty(key,JSON.stringify({id:id,hash:hash,status:'sending',at:new Date().toISOString()}));
    try {
      MailApp.sendEmail({to:'tticdlrecruiting@gmail.com',subject:'[TTI conversation] '+String(c.outcome)+' · '+String(c.driver.recordedName||c.driver.phone||c.conversationId).replace(/[\r\n]/g,' ').slice(0,100),body:body,name:'TTI Recruiter'});
      properties.setProperty(key,JSON.stringify({id:id,hash:hash,status:'sent',at:new Date().toISOString()}));
      return response('sent',true,false);
    } catch(error) {
      // A send exception OR failure to persist its acknowledgement can occur after delivery.
      // Preserve reservation; never allow an automatic resend of an uncertain message.
      properties.setProperty(key,JSON.stringify({id:id,hash:hash,status:'unconfirmed',at:new Date().toISOString()}));
      return response('unconfirmed',false,false);
    }
  } finally {lock.releaseLock();}
}
