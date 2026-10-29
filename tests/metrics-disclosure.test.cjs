'use strict';
const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs');const path=require('node:path');
const root=path.resolve(__dirname,'..');
test('public privacy and footers disclose aggregate metrics and remove no-tracking promises',()=>{
 for(const file of ['platform/packages/ui/src/index.tsx','platform/packages/ui/src/studio.tsx','platform/apps/hub/app/check/page.tsx','platform/apps/hub/app/privacy/page.tsx']){
  const s=fs.readFileSync(path.join(root,file),'utf8');assert.match(s,/匿名/,file);assert.doesNotMatch(s,/不設 Cookie、不追蹤|不傳送、不儲存、不追蹤|或統計追蹤/,file);
 }
 const privacy=fs.readFileSync(path.join(root,'platform/apps/hub/app/privacy/page.tsx'),'utf8');for(const phrase of ['90 天','IP','不代表不重複人數','Do Not Track'])assert.ok(privacy.includes(phrase),phrase);
});
