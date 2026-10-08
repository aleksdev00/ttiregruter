// Vinext page params are canonical URL-encoded captures (unlike API params).
// Decode once at the page boundary, before lookups or generating return URLs.
export function decodePageId(value:string):string {
 try{return decodeURIComponent(value);}catch{return value;}
}
