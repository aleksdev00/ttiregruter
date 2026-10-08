import {effectiveCatalogOffer} from '../content/carrier-catalog/ownerCatalog.ts';
import type {Offer} from '../contracts/index.ts';

export function offerPresentation(offer:Offer){
 offer=effectiveCatalogOffer(offer);
 const terms=offer.documentedTerms;
 const program=terms?.program??offer.employment;
 const programLabel=({company:'Company driver',lease:'Lease',owner_operator:'Owner-operator',w2:'Company driver · W-2','1099':'Company driver · 1099',unknown:'Program to confirm'} as const)[program];
 const rows=[
  {label:'Pay / program',value:terms?.summary||offer.pay.note||'Confirm the current pay and pay basis with the carrier.'},
  {label:'Schedule / home time',value:terms?.schedule||[offer.routeType?.toUpperCase(),offer.homeTime?.replaceAll('_',' ')].filter(Boolean).join(' · ')||'Confirm the route and home-time schedule with the carrier.'},
  {label:'Truck / trailer',value:terms?.equipment||'Confirm the available equipment and assignment with the carrier.'},
  ...(terms?.deductions.length?[{label:'Deductions / costs',value:terms.deductions.join('\n')}]:[]),
  ...(offer.minExperienceMonths!==null?[{label:'Experience',value:`Catalog minimum: ${offer.minExperienceMonths} months. Confirm the applicable program requirement.`}]:[]),
  ...(offer.hiringStates?.length?[{label:'Hiring locations',value:offer.hiringStates.join(', ')}]:[]),
  ...(offer.matchingCriteria?[{label:'SAP / RTD policy',value:({no_history:'No SAP history accepted, including completed SAP / RTD.',completed_only:'Completed SAP / RTD only; verify documents and individual approval.',consider:'SAP candidates may be considered; completion / RTD conditions need review.',unknown:'SAP / RTD policy is not documented; verify before recommending.'} as const)[offer.matchingCriteria.sap]},
   {label:'Documented equipment / routes',value:[offer.matchingCriteria.trailers.join(', ')||'Equipment needs verification',offer.matchingCriteria.routes.join(', ')||'Routes need verification'].join(' · ')},
   ...(offer.matchingCriteria.excludedStates.length?[{label:'Excluded hiring states',value:offer.matchingCriteria.excludedStates.join(', ')}]:[]),
   ...(offer.matchingCriteria.minimumOutDays?[{label:'Minimum time out',value:`${offer.matchingCriteria.minimumOutDays} days; residence and program may require longer.`}]:[])]:[]),
 ];
 const verification=[...(offer.matchingCriteria?.review??[]),...(terms?.verification??[]),...(offer.employment==='unknown'?['W-2/1099 classification']:[]),...(!offer.hiringStates?['Hiring eligibility in the driver’s location']:[]),...(!offer.requiredLicense?['Required CDL class']:[]),...(offer.minExperienceMonths===null?['Minimum experience for this program']:[])];
 return {programLabel,rows,verification:[...new Set(verification)],source:terms?.source??offer.source,status:offer.approvalStatus==='approved'&&offer.active&&offer.recruitingApproved!==false?'Approved catalog terms':'Catalog terms · current opening needs verification'};
}
