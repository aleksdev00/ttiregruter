// Explicit catalog removal requested by the application administrator, 2026-10-04.
// Historical records remain available; this is never inferred from driver data.
export const requestedCatalogRemovals=[{id:'chi-logistics',name:'CHI LOGISTICS',reason:'Administrator requested removal of CHI Logistics on 2026-10-04.'}] as const;
export const removedCatalogCompany=(id:string|undefined,name:string)=>requestedCatalogRemovals.some(c=>c.id===id||c.name.toLowerCase()===name.trim().toLowerCase());
