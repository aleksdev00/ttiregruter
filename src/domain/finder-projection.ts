import type {Conversation} from '../contracts/index.ts';

export type FinderFilters={position:string;employmentType:string;home:string;trailer:string;experienceMonths:string;sap:string};

/** Apply the exact Company Finder filters to a comparison-only copy of a call. */
export function projectFinderConversation(c:Conversation,filters:FinderFilters):Conversation{
 const next=structuredClone(c);
 next.playbook??={notes:{nonNegotiables:'',verifiedTermsDiscussed:'',unresolvedQuestion:'',contactPreferences:'',nextAction:'',owner:'',dueAt:null,dueTimeZone:'',channel:'unknown'},last1099StepId:null,applicationStatus:'unknown',communicationStatus:'not_prepared',communicationPermission:'unknown'};
 const guide=next.playbook.guide??{answers:{},confirmed:{},reviewReasons:{},lastAnswered:null};next.playbook.guide=guide;
 for(const key of Object.keys(filters) as (keyof FinderFilters)[]){const value=filters[key];if(value){guide.answers[key]=value;guide.confirmed[key]=true;delete guide.reviewReasons[key];}else{delete guide.answers[key];delete guide.confirmed[key];}}
 const bounds=filters.experienceMonths==='0-6'?[0,6]:filters.experienceMonths==='6-12'?[6,12]:filters.experienceMonths==='12-24'?[12,24]:filters.experienceMonths==='24+'?[24,null]:null;
 if(bounds){guide.answers.experienceMonths=String(bounds[0]);guide.confirmed.experienceMonths=true;next.answers.experienceMonths=bounds[0];}
 else{delete guide.answers.experienceMonths;delete guide.confirmed.experienceMonths;next.answers.experienceMonths=null;}
 return next;
}
