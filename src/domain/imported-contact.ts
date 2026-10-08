import type {Contact} from '../contracts/index.ts';
export function importedContactInformation(contact:Contact){
 if(!contact.rawFields.legacy_source_project)return '';
 const labels:Record<string,string>={desired_position:'Driver type',employment_type_preference:'Employment preference',cdl:'CDL',experience_months:'Experience months',experience_text:'Experience',sap_status:'SAP / RTD',equipment_preference:'Trailer',truck_preference:'Truck',transmission_preference:'Transmission',route_preference:'Route',home_time:'Home time',location_zip:'ZIP',pay_target:'Pay target',start_availability:'Availability',main_priority:'Main priority',dealbreakers:'Deal-breakers',notes:'Notes',follow_up_note:'Callback note',lead_status:'Previous disposition',last_call_outcome:'Previous call outcome',next_step:'Previous next step',legacy_review:'Owner review'};
 return ['Recorded in old TTI Recruiter. Confirm changes explicitly; these records do not advance the current conversation.',...Object.entries(labels).flatMap(([field,label])=>contact.rawFields[field]!==null&&contact.rawFields[field]!==undefined&&contact.rawFields[field]!==''?[`${label}: ${contact.rawFields[field]}`]:[])].join('\n\n');
}
