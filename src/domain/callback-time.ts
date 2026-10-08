// Interpret the agreed wall-clock time in the driver's recorded IANA zone.
// Reject nonexistent and ambiguous DST times rather than guessing an appointment.
function parts(date:Date,zone:string){const p=new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date);const v=(key:string)=>p.find(x=>x.type===key)?.value;return `${v('year')}-${v('month')}-${v('day')}T${v('hour')}:${v('minute')}`;}
export function callbackInput(value:string,zone:string){if(!value)return '';if(!/[zZ]|[+-]\d\d:\d\d$/.test(value))return value.slice(0,16);try{return parts(new Date(value),zone);}catch{return value.slice(0,16);}}
export function callbackInstant(value:string,zone:string):string{
 if(!zone.trim())throw new Error('Record the driver’s agreed time zone before finishing the callback.');
 try{new Intl.DateTimeFormat('en-US',{timeZone:zone});}catch{throw new Error('Use a valid time zone, such as America/Chicago.');}
 if(/[zZ]|[+-]\d\d:\d\d$/.test(value)&&Number.isFinite(Date.parse(value)))return new Date(value).toISOString();
 if(!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(value))throw new Error('Record the agreed callback date and time.');
 const wall=Date.parse(value+'Z');if(!Number.isFinite(wall))throw new Error('Record a valid callback date.');
 let guess=wall;
 for(let i=0;i<3;i++){const displayed=Date.parse(parts(new Date(guess),zone)+'Z');guess+=wall-displayed;}
 if(parts(new Date(guess),zone)!==value)throw new Error('That time does not exist in the chosen time zone. Confirm another callback time.');
 if([-3600000,3600000].some(delta=>parts(new Date(guess+delta),zone)===value))throw new Error('That time occurs twice because clocks change. Confirm an unambiguous callback time.');
 return new Date(guess).toISOString();
}
