import source from './policies.json';
export interface Policy {id:string;category:string;title:string;highlightId:number|null;storyUrl:string|null;sourceUrl:string;plain:string|null;keywords:string[];updatedAt:string}
export const POLICIES:ReadonlyArray<Readonly<Policy>>=Object.freeze(source.map(p=>Object.freeze(p)));
export function validatePolicies(rows:ReadonlyArray<Readonly<Policy>>):boolean {
 const expected:Record<string,number>={'交通公安':22,'產業就業':25,'健康養護':19,'文教社福':32,'韌性永續':19};
 if(rows.length!==117||new Set(rows.map(p=>p.id)).size!==117)throw new Error('Policy count or unique id mismatch');
 for(const [category,n]of Object.entries(expected))if(rows.filter(p=>p.category===category).length!==n)throw new Error('Category mismatch');
 for(const p of rows){if(!/^(TRA|IND|HEA|EDU|RES)-\d{2}$/.test(p.id)||!p.title.trim())throw new Error('Invalid policy');
  if(new URL(p.sourceUrl).href!=='https://taichungway.tw/future')throw new Error('Unapproved source');
  if(p.storyUrl && new URL(p.storyUrl).origin!=='https://taichungway.tw')throw new Error('Unapproved story');
  if(p.highlightId!==null && (!Number.isInteger(p.highlightId)||p.highlightId<1||p.highlightId>10))throw new Error('Invalid highlight');
 }return true;
}
