import type { Contact, Offer, Result } from './index';
export interface ContactsImportAdapter { importApprovedContacts(): Promise<Result<Contact[]>> }
export interface OffersSourceAdapter { loadApprovedOffers(): Promise<Result<Offer[]>> }
export interface ReferralConfigAdapter { getReferral(recruiterId:string): Promise<Result<string>> }
export interface ApplicationStatusAdapter { verifyApplication(externalId:string): Promise<Result<boolean>> }
export const integrationStatus = { contacts: 'not_configured', offers: 'synthetic_only', referral: 'not_configured', applications: 'demo_simulation_only' } as const;
