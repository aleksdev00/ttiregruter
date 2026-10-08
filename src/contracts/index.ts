import type { PlaybookOutcome, PlaybookState, CallNotes } from './playbook.ts';
export type ISODate = string; // Validated UTC ISO string at boundaries.
export type ContactStatus =
  | 'available' | 'reserved' | 'callback_due'
  | 'closed' | 'do_not_contact' | 'invalid_number';
export type ConversationStatus = 'active' | 'paused' | 'closed' | 'cancelled';
export type NameEvidence = 'explicit_source' | 'driver_confirmed' | 'suggested' | 'unknown';
export type EmploymentPreference = 'w2' | '1099' | 'either' | 'unknown';
export type CallOutcome =
  | 'no_answer' | 'callback' | 'not_interested' | 'interested'
  | 'driver_reports_applied' | 'wrong_number' | 'do_not_contact' | PlaybookOutcome;

export interface Recruiter {
  id: string;
  fullName: string;
  alias: string;
  accountRole?: 'owner' | 'admin' | 'recruiter';
  referralUrl: string | null;
  callbackNumber?: string | null;
  contactEmail?: string | null;
  faqFacts?: Record<string, {value:string;source:string;verifiedAt:ISODate;expiresAt:ISODate}>;
  reportingTimeZone: string;
  isDemo: boolean;
}

export interface Contact {
  id: string;
  firstName: string | null;
  lastName: string | null;
  nameEvidence: NameEvidence;
  phoneRaw: string | null;
  phoneNormalized: string | null;
  email: string | null;
  city: string | null;
  state: string | null;
  sourceLabel: string | null;
  sourceRecordId: string | null;
  status: ContactStatus;
  ownerRecruiterId?: string | null;
  reservedBy: string | null;
  activeConversationId: string | null;
  callbackAt: ISODate | null;
  rawFields: Record<string, string | number | boolean | null>;
  isDemo: boolean;
}

export interface DriverAnswers {
  nonNegotiables?: string | null;
  position?: 'company' | 'lease' | 'owner_operator' | 'unknown';
  safeToTalk: boolean | null;
  preferredName: string | null;
  priority: 'pay' | 'home_time' | 'routes' | 'equipment' | 'other' | null;
  homeState: string | null;
  licenseClass: 'A' | 'B' | 'other' | 'unknown';
  experienceMonths: number | null;
  employment: EmploymentPreference;
  routePreference: 'otr' | 'regional' | 'local' | 'any' | 'unknown';
  homeTimePreference: 'daily' | 'weekly' | 'flexible' | 'unknown';
  startWindow: 'now' | 'two_weeks' | 'later' | 'unknown';
}

export interface Conversation {
  id: string;
  contactId: string;
  recruiterId: string;
  status: ConversationStatus;
  activeStepId: string;
  answers: DriverAnswers;
  selectedOfferId: string | null;
  startedAt: ISODate;
  updatedAt: ISODate;
  closedAt: ISODate | null;
  outcome: CallOutcome | null;
  scriptVersion: string;
  offerSnapshotVersion: string;
  revision: number;
  playbook?: PlaybookState;
}

export interface CarrierRule {
  field: 'position'|'employmentType'|'state'|'locationZip'|'experienceMonths'|'sap'|'trailer'|'truck'|'route'|'home'|'payTarget'|'availability'|'priority'|'dealbreakers';
  kind: 'hard' | 'preference';
  operator: 'in' | 'minimum' | 'maximum';
  values: string[];
  label: string;
}
export interface Offer {
  id: string;
  companyName: string;
  urgent?: boolean;
  matchingCriteria?: CarrierCriteria;
  active: boolean;
  employment: 'w2' | '1099' | 'lease' | 'owner_operator' | 'unknown';
  documentedTerms?: {
    program: 'company'|'lease'|'owner_operator'|'unknown';
    summary: string;
    schedule: string;
    equipment: string;
    deductions: string[];
    verification: string[];
    source: string;
  };
  approvalStatus?: 'approved' | 'pending_review' | 'waiting_for_reply' | 'prospect';
  recruitingApproved?: boolean;
  requirements?: CarrierRule[];
  hiringStates: string[] | null; // null = unknown, [] = no covered states.
  requiredLicense: 'A' | 'B' | null;
  minExperienceMonths: number | null;
  routeType: 'otr' | 'regional' | 'local' | null;
  homeTime: 'daily' | 'weekly' | 'flexible' | null;
  pay: {
    unit: 'cpm' | 'weekly' | 'hourly' | 'percentage' | 'unknown';
    min: number | null;
    max: number | null;
    currency: 'USD';
    basis: 'advertised' | 'guaranteed' | 'unknown';
    note: string;
  };
  restrictions: string[];
  source: 'synthetic' | 'google_sheet' | 'approved_snapshot';
  sourceRowId: string | null;
  verifiedAt: ISODate | null;
  expiresAt: ISODate | null;
  faqFacts?: Record<string, {value:string;source:string;verifiedAt:ISODate;expiresAt:ISODate}>;
  snapshotVersion: string;
  isDemo: boolean;
}

// Explicit workbook facts, separate from availability, approval and preferences.
export interface CarrierCriteria {
  source: string;
  sap: 'no_history'|'completed_only'|'consider'|'unknown';
  trailers: string[];
  excludedTrailers: string[];
  trucks: string[];
  routes: string[];
  excludedStates: string[];
  excludedCities: string[];
  minimumOutDays: number|null;
  stateMinimumOutDays: Record<string,number>;
  minimumExperienceMonths: number|null;
  trailerExperienceMonths: Record<string,number>;
  review: string[];
}

export type MatchState = 'match' | 'potential_fit' | 'needs_confirmation' | 'not_fit' | 'unavailable';
export interface OfferMatch {
  offerId: string;
  state: MatchState;
  reasons: string[];
  missingFacts: string[];
  conflicts: string[];
  preferenceScore: number; // Internal sort only; never a hiring probability.
}

export type FailureCode =
  | 'not_found' | 'conflict' | 'active_conversation_exists'
  | 'invalid_input' | 'not_configured' | 'storage_failed' | 'not_allowed';
export type Result<T> = { ok: true; value: T } | { ok: false; code: FailureCode; message: string };
export interface MutationMeta { requestId: string; expectedRevision?: number }
export interface AuditEvent {
  id: string;
  requestId: string;
  type: string;
  recruiterId: string;
  contactId: string | null;
  conversationId: string | null;
  occurredAt: ISODate;
  isDemo: boolean;
  data: Record<string, string | number | boolean | null>;
}
export interface AppSnapshot {
  schemaVersion: 1;
  recruiter: Recruiter;
  contacts: Contact[];
  conversations: Conversation[];
  offers: Offer[];
  events: AuditEvent[];
}
export interface RecruiterRepository {
  load(): Promise<Result<AppSnapshot>>;
  claimContact(contactId: string, meta: MutationMeta): Promise<Result<Conversation>>;
  saveAnswers(id: string, patch: Partial<DriverAnswers>, stepId: string,
    meta: MutationMeta): Promise<Result<Conversation>>;
  correctName(id:string,name:string|null,meta:MutationMeta):Promise<Result<Conversation>>;
  recordAttempt(id: string, meta: MutationMeta): Promise<Result<string>>;
  recordConnected(id: string, attemptId: string, meta: MutationMeta): Promise<Result<void>>;
  selectOffer(id: string, offerId: string | null, meta: MutationMeta): Promise<Result<Conversation>>;
  pause(id: string, meta: MutationMeta): Promise<Result<Conversation>>;
  resume(id: string, meta: MutationMeta): Promise<Result<Conversation>>;
  cancelBeforeAttempt(id: string, meta: MutationMeta): Promise<Result<void>>;
  finish(id: string, outcome: CallOutcome, callbackAt: ISODate | null,
    meta: MutationMeta): Promise<Result<Conversation>>;
  simulateApplication(id: string, meta: MutationMeta): Promise<Result<string>>;
  conversationAction(id:string,action:import('../domain/conversation.ts').ConversationAction,meta:MutationMeta):Promise<Result<Conversation>>;
  selectObjection(id:string,scenarioId:string,meta:MutationMeta):Promise<Result<Conversation>>;
  saveOutcomeDraft(id:string,outcome:CallOutcome|null,callbackAt:string|null,meta:MutationMeta):Promise<Result<Conversation>>;
  saveGuideAnswer(id:string,questionId:string,value:string,reviewReason:string,meta:MutationMeta,status?:import('../domain/guide.ts').AnswerStatus):Promise<Result<Conversation>>;
  saveCallNotes(id:string,patch:Partial<CallNotes>,meta:MutationMeta):Promise<Result<Conversation>>;
  saveCommunicationPermission(id:string,permission:'unknown'|'allowed'|'declined',meta:MutationMeta):Promise<Result<Conversation>>;
  recordCommunication(id:string,status:'draft_prepared'|'copied'|'manual_sent_reported'|'opened',meta:MutationMeta):Promise<Result<Conversation>>;
  suppressContact(id:string,meta:MutationMeta):Promise<Result<Conversation>>;
  resetDemo(): Promise<Result<AppSnapshot>>;
}
