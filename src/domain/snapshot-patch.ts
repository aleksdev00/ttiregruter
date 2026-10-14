import type {AppSnapshot} from '../contracts/index.ts';

function mergeById<T extends {id:string}>(current:T[],patch:T[]):T[]{
 const updated=new Map(patch.map(item=>[item.id,item]));
 return [...current.map(item=>{const replacement=updated.get(item.id);updated.delete(item.id);return replacement??item;}),...updated.values()];
}

// The server sends a database-confirmed patch after each mutation. Merge it
// into the loaded snapshot so the client can avoid a second full-state read.
export function mergeConfirmedSnapshot(current:AppSnapshot,patch:AppSnapshot):AppSnapshot{
 if(current.recruiter.id!==patch.recruiter.id)throw Error('Confirmed update belongs to a different recruiter.');
 return {...current,recruiter:patch.recruiter,contacts:mergeById(current.contacts,patch.contacts),conversations:mergeById(current.conversations,patch.conversations),events:mergeById(current.events,patch.events),offers:patch.offers};
}
