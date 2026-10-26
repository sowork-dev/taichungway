import test from 'node:test';
import assert from 'node:assert/strict';
import {POLICIES, validatePolicies} from '../packages/policy-data/src/index';
test('only the official 117 original headings are accepted with exact category counts',()=>{
 assert.equal(POLICIES.length,117); assert.equal(validatePolicies(POLICIES),true);
 assert.equal(POLICIES[0].title,'捷運多線齊發，力拚藍線完工');
 const counts:Record<string,number>={};for(const p of POLICIES)counts[p.category]=(counts[p.category]||0)+1;
 assert.deepEqual(counts,{'交通公安':22,'產業就業':25,'健康養護':19,'文教社福':32,'韌性永續':19});
 assert.ok(POLICIES.every(p=>p.plain===null && p.sourceUrl==='https://taichungway.tw/future'));
});
