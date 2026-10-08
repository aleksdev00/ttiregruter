import type {AppSnapshot} from '../contracts/index.ts';
function mergeById<T extends {id:string}>(current:T[],patch:T[]):T[]{const updated=new Map(patch.map(x=>[x.id,x]));return [...current.map(x=>{const replacement=updated.get(x.id);updated.delete(x.id);return replacement??x;}),...updated.values()];}
// Patch is read back from the database after a committed, authenticated mutation.
export function mergeConfirmedSnapshot(current:AppSnapshot,patch:AppSnapshot):AppSnapshot{
 if(current.recruiter.id!==patch.recruiter.id)throw Error('Confirmed update belongs to a different recruiter.');
 return {...current,recruiter:patch.recruiter,contacts:mergeById(current.contacts,patch.contacts),conversations:mergeById(current.conversations,patch.conversations),events:mergeById(current.events,patch.events),offers:patch.offers};
}
