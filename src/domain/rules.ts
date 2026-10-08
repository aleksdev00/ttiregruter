import type { Contact, DriverAnswers, Offer, OfferMatch, AuditEvent } from '../contracts/index.ts';

export const emptyAnswers: DriverAnswers = { nonNegotiables: null, safeToTalk: null, preferredName: null, priority: null, homeState: null, licenseClass: 'unknown', experienceMonths: null, employment: 'unknown', routePreference: 'unknown', homeTimePreference: 'unknown', startWindow: 'unknown' };
export const steps = ['incidents', 'opening', 'name', 'priority', 'non_negotiables', 'w2_handoff', 'qualification_blocked', 'state', 'license', 'experience', 'employment', 'routes', 'home', 'start', 'offer', 'application'] as const;
export function isGenericContactName(name:string):boolean {
  return /^(wireless caller|wireless|caller|private caller|private number|anonymous|restricted|unavailable|unknown caller|no name|name not recorded|not recorded|unknown|n\/?a)$/i.test(name.trim());
}
export function displayName(c: Contact): string {
  const name=[c.firstName,c.lastName].filter(Boolean).join(' ');
  return ['explicit_source', 'driver_confirmed'].includes(c.nameEvidence) && c.firstName && !isGenericContactName(name) ? name : 'Name not recorded';
}
export function greetingName(c: Contact, a: DriverAnswers): string | null {
  const name=a.preferredName || (['explicit_source', 'driver_confirmed'].includes(c.nameEvidence) ? c.firstName : null);
  if(!name||!name.trim()||isGenericContactName(name)||(!a.preferredName&&isGenericContactName([c.firstName,c.lastName].filter(Boolean).join(' ')))||[c.id,c.sourceRecordId].includes(name)||/^(unknown|n\/?a|contact\b|DEMO[- ]|record[- ]|id[- ])/i.test(name.trim()))return null;
  return name.trim();
}
export function validateAnswers(a: DriverAnswers): string | null {
  if (a.experienceMonths !== null && (!Number.isInteger(a.experienceMonths) || a.experienceMonths < 0 || a.experienceMonths > 720)) return 'Enter experience from 0 to 720 whole months, or leave it unknown.';
  if (a.homeState !== null && !'AL AK AZ AR CA CO CT DE DC FL GA HI ID IL IN IA KS KY LA ME MD MA MI MN MS MO MT NE NV NH NJ NM NY NC ND OH OK OR PA RI SC SD TN TX UT VT VA WA WV WI WY'.split(' ').includes(a.homeState)) return 'Use a two-letter US state code, or leave it unknown.';
  if (a.preferredName !== null && (a.preferredName.trim().length === 0 || a.preferredName.length > 80)) return 'Enter a name of 1 to 80 characters, or leave it unknown.';
  return null;
}
export function matchOffer(o: Offer, a: DriverAnswers, now = new Date()): OfferMatch {
  const conflicts: string[] = [], missingFacts: string[] = [], reasons: string[] = [];
  const documentedReview=!!o.documentedTerms&&o.approvalStatus==='pending_review'&&!o.isDemo;
  if ((!documentedReview&&(!o.active || o.recruitingApproved===false || (o.approvalStatus&&o.approvalStatus!=='approved'))) || (o.expiresAt && new Date(o.expiresAt) <= now)) return { offerId: o.id, state: 'unavailable', reasons: ['Offer unavailable'], conflicts: [], missingFacts: [], preferenceScore: 0 };
  if(documentedReview)missingFacts.push('Current opening and individual carrier approval require verification');
  if(o.employment==='unknown')missingFacts.push('Employment classification or program requires verification');
  if (o.hiringStates === null || a.homeState === null) missingFacts.push('Hiring location needs confirmation');
  else if (!o.hiringStates.includes(a.homeState)) conflicts.push('Location not covered'); else reasons.push('Hiring in the reported home state');
  if (o.requiredLicense === null || a.licenseClass === 'unknown') missingFacts.push('CDL requirement needs confirmation');
  else if (o.requiredLicense !== a.licenseClass) conflicts.push('CDL class does not meet the listed requirement'); else reasons.push('Self-reported CDL class aligns');
  if (o.minExperienceMonths === null || a.experienceMonths === null) missingFacts.push('Experience needs confirmation');
  else if (a.experienceMonths < o.minExperienceMonths) conflicts.push(`Requires ${o.minExperienceMonths} months of experience`); else reasons.push('Self-reported experience aligns');
  const program=o.documentedTerms?.program??(['lease','owner_operator'].includes(o.employment)?o.employment:'company');
  if(a.position&&a.position!=='unknown'&&program!=='unknown'&&program!==a.position)conflicts.push('Position type does not match the selected branch');
  if (!['lease','owner_operator'].includes(a.position??'') && o.employment!=='unknown' && a.employment !== 'either' && a.employment !== 'unknown' && a.employment !== o.employment) conflicts.push('Employment preference differs');
  if (a.routePreference !== 'any' && a.routePreference !== 'unknown') {
    if (o.routeType === null) missingFacts.push('Route type needs confirmation'); else if (a.routePreference !== o.routeType) conflicts.push('Route preference differs'); else reasons.push('Matches the requested route');
  }
  if (a.homeTimePreference !== 'unknown' && a.homeTimePreference !== 'flexible') {
    if (o.homeTime === null) missingFacts.push('Home time needs confirmation'); else if (a.homeTimePreference !== o.homeTime) conflicts.push('Home time preference differs'); else reasons.push('Matches the requested home time');
  }
  const preferenceScore = (a.priority === 'home_time' && o.homeTime === 'daily' ? 3 : 0) + (a.priority === 'routes' && o.routeType === a.routePreference ? 3 : 0) + reasons.length;
  return { offerId: o.id, state: conflicts.length ? 'not_fit' : missingFacts.length ? 'needs_confirmation' : 'potential_fit', reasons, conflicts, missingFacts, preferenceScore };
}
export function rankedOffers(offers: Offer[], a: DriverAnswers) {
  return offers.map(offer => ({ offer, match: matchOffer(offer, a) })).sort((x, y) => Number(y.match.state === 'potential_fit') - Number(x.match.state === 'potential_fit') || y.match.preferenceScore - x.match.preferenceScore);
}
function dayKey(date: Date, zone: string) { return new Intl.DateTimeFormat('en-CA', { timeZone: zone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function analytics(events: AuditEvent[], zone: string, now = new Date()) {
  const today = dayKey(now, zone), anchor = new Date(`${today}T12:00:00Z`);
  const keyAgo = (n: number) => { const d = new Date(anchor); d.setUTCDate(d.getUTCDate() - n); return d.toISOString().slice(0, 10); };
  const mondayAgo = (anchor.getUTCDay() + 6) % 7;
  const unique = (type: string) => [...new Map(events.filter(e => e.type === type).map(e => [String(e.data.attemptId ?? e.data.applicationId ?? e.id), e])).values()];
  const calls = unique('call_attempt_started'), apps = [...unique('application_demo_confirmed'),...unique('internal_application_finalized')];
  const count = (list: AuditEvent[], from: string, to = from) => list.filter(e => { const k = dayKey(new Date(e.occurredAt), zone); return k >= from && k <= to; }).length;
  const callsToday = count(calls, today), yesterday = count(calls, keyAgo(1));
  return { totalCalls: calls.length, callsToday, callsWeek: count(calls, keyAgo(mondayAgo), today), appsToday: count(apps, today), appsWeek: count(apps, keyAgo(mondayAgo), today), yesterday, delta: callsToday - yesterday, percent: yesterday ? Math.round((callsToday - yesterday) / yesterday * 100) : null, average: count(calls, keyAgo(7), keyAgo(1)) / 7 };
}
