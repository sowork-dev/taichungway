"""New single-screen water-balloon main flow; real 2-client WS, no test teleport."""
import sys,json,time
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8793').rstrip('/')
qa=Path(__file__).resolve().parents[1]/'qa';qa.mkdir(exist_ok=True)
r={'status':'incomplete','base':base,'checks':[],'participants':'two automated independent browser contexts, not human usability proof'}
def save():(qa/'bubble-browser-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def check(name,ok):r['checks'].append({'name':name,'passed':bool(ok)});save();assert ok,name
def wait(pg,expr,ms=18000):
 try:pg.wait_for_function('() => '+expr,timeout=ms)
 except Exception:r['failure']={'expression':expr,'snapshot':pg.evaluate('window.PlayGame?.snapshot()')};pg.screenshot(path=str(qa/'bubble-failure.png'));save();raise
save()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch();cs=[browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True) for _ in range(2)];a,b=[c.new_page() for c in cs];errors=[]
  cs[0].add_init_script('Object.defineProperty(navigator,"clipboard",{get:()=>undefined});Object.defineProperty(navigator,"share",{get:()=>undefined})')
  for pg in [a,b]:pg.on('pageerror',lambda e:errors.append(str(e)))
  a.goto(base,wait_until='domcontentloaded');a.wait_for_selector('#bombButton',state='attached',timeout=10000)
  check('only one gameplay action',a.locator('#gameControls .action-buttons button').count()==1)
  check('not another delivery/quiz reskin',a.locator('#dashButton,#tagButton,#pkQuestion').count()==0)
  check('AI disclosure stays visible','非本人' in a.locator('#avatarDisclosure').inner_text())
  a.locator('#lobbyButton').click();a.locator('#lobbyPractice').click();wait(a,'window.PlayGame&&PlayGame.snapshot().connected&&PlayGame.snapshot().state.kind==="bubble"')
  code=a.evaluate('PlayGame.snapshot().code');check('honest solo practice',a.evaluate('PlayGame.snapshot().state.phase==="practice"&&PlayGame.snapshot().state.players.length===1'))
  check('entire grid is visible without camera',a.evaluate('(()=>{let v=PlayGame.snapshot().view;return v.cameraX===0&&v.cameraY===0&&v.x>=0&&v.y>=0&&v.x+v.width<=v.canvasWidth+1&&v.y+v.height<=v.canvasHeight+1})()'))
  check('large cell-sized characters',a.evaluate('PlayGame.snapshot().view.scale*52>=28'))
  a.locator('#bombButton').click();wait(a,'PlayGame.snapshot().state.bombs.length===1');check('one tap places a real server balloon',True)
  wait(a,'PlayGame.snapshot().state.crates.some(c=>!c.alive)');check('water actually clears a policy street block',True)
  check('practice feedback without invented opponent',a.evaluate('PlayGame.snapshot().self.score>0&&PlayGame.snapshot().state.players.length===1'))
  a.screenshot(path=str(qa/'bubble-solo-live.png'))
  a.locator('#inviteButton').click();a.wait_for_selector('#infoDialog[open] .share-box');invite=a.locator('.share-box').input_value();check('real invitation excludes token',invite==base+'/?room='+code);a.locator('#closeInfo').click()
  b.goto(base,wait_until='domcontentloaded');b.locator('#lobbyButton').click();wait(b,'document.querySelectorAll("#lobbyRooms [data-room]").length>0');b.locator('#lobbyRooms [data-room="'+code+'"]').click()
  for pg in [a,b]:wait(pg,'PlayGame.snapshot().state.phase==="playing"&&PlayGame.snapshot().state.players.length===2')
  check('same real room through public lobby',b.evaluate('PlayGame.snapshot().code')==code)
  check('practice reset for both',a.evaluate('PlayGame.snapshot().state.players.every(p=>p.score===0)&&PlayGame.snapshot().state.crates.every(c=>c.alive)'))
  check('opponent fits on same screen',b.evaluate('PlayGame.snapshot().view.cameraX===0&&PlayGame.snapshot().view.cameraY===0'))
  # Planning reads public geometry only. Execution uses ordinary navigate/action intents.
  def move(pg,c,row):
   x=(c+.5)*64;y=(row+.5)*64;ok=pg.evaluate('([x,y])=>PlayGame.walkTo(x,y)',[x,y]);assert ok,('unreachable target',c,row)
   wait(pg,'Math.hypot(PlayGame.snapshot().self.x-'+str(x)+',PlayGame.snapshot().self.y-'+str(y)+')<8',16000)
  def plant_escape(pg):
   pg.locator('#bombButton').click();wait(pg,'PlayGame.snapshot().state.bombs.some(b=>b.ownerId===PlayGame.snapshot().you)')
   goal=pg.evaluate('''(()=>{let {state:s,self:p,you}=PlayGame.snapshot(),A=BubbleCore,b=s.bombs.find(b=>b.ownerId===you),hot=new Set(A.blastCells(s,b).map(t=>t.c+','+t.r));let options=[];for(let row=1;row<A.ROWS-1;row++)for(let c=1;c<A.COLS-1;c++){if(hot.has(c+','+row))continue;let x=(c+.5)*64,y=(row+.5)*64,path=A.findPath(p.x,p.y,x,y,s);if(path.length){let length=0,last=p;for(let n of path){length+=Math.hypot(last.x-n.x,last.y-n.y);last=n;}if(length<250)options.push({c,row,length});}}options.sort((a,b)=>a.length-b.length);return options[0]||null})()''')
   assert goal,'no actual escape route';move(pg,goal['c'],goal['row']);wait(pg,'PlayGame.snapshot().state.bombs.every(b=>b.ownerId!==PlayGame.snapshot().you)');wait(pg,'PlayGame.snapshot().self.trappedUntil<=PlayGame.snapshot().state.now')
  # Clear an actual route toward the second player, walking and placing water balls.
  for _ in range(9):
   plan=a.evaluate('''(()=>{let {state:s,self:p}=PlayGame.snapshot(),A=BubbleCore,sc=Math.floor(p.x/64),sr=Math.floor(p.y/64),walls=new Set(s.walls.map(w=>w.c+','+w.r)),alive=new Set(s.crates.filter(c=>c.alive).map(c=>c.c+','+c.r)),q=[[sc,sr]],prev=new Map([[sc+','+sr,null]]),target='7,10';for(let h=0;h<q.length;h++){let [c,r]=q[h],key=c+','+r;if(key===target){let chain=[];for(let k=key;k!==null;k=prev.get(k))chain.push(k.split(',').map(Number));chain.reverse();for(let i=1;i<chain.length;i++)if(alive.has(chain[i].join(',')))return {blocked:true,c:chain[i-1][0],row:chain[i-1][1]};return {blocked:false,c:7,row:10};}for(let [dc,dr]of[[1,0],[-1,0],[0,1],[0,-1]]){let nc=c+dc,nr=r+dr,k=nc+','+nr;if(nc>0&&nc<8&&nr>0&&nr<12&&!walls.has(k)&&!prev.has(k)){prev.set(k,key);q.push([nc,nr]);}}}return null})()''')
   assert plan,'no structural path';move(a,plan['c'],plan['row'])
   if not plan['blocked']:break
   plant_escape(a)
  else:raise AssertionError('route not cleared within bounded actions')
  check('opens route with real water and normal movement',True)
  # B remains at its real spawn (7,11). No browser or API position injection.
  for point in range(1,4):
   move(a,7,10);plant_escape(a);wait(a,'PlayGame.snapshot().self.score>='+str(point),5000)
   wait(b,'PlayGame.snapshot().state.players.some(p=>p.id!==PlayGame.snapshot().you&&p.score>='+str(point)+')')
   check('capture and score synchronize '+str(point),True)
   if point==1:a.screenshot(path=str(qa/'bubble-pvp-live-a.png'));b.screenshot(path=str(qa/'bubble-pvp-live-b.png'))
  for pg in [a,b]:wait(pg,'PlayGame.snapshot().state.phase==="finished"')
  check('first to3 produces the same actual winner',a.evaluate('PlayGame.snapshot().state.winnerIds')==b.evaluate('PlayGame.snapshot().state.winnerIds')==[a.evaluate('PlayGame.snapshot().you')])
  a.locator('#rematchButton').click();b.locator('#rematchButton').click()
  for pg in [a,b]:wait(pg,'PlayGame.snapshot().state.phase==="playing"&&PlayGame.snapshot().self.score===0')
  check('rematch resets field balloons and scores',a.evaluate('PlayGame.snapshot().state.bombs.length===0&&PlayGame.snapshot().state.crates.every(c=>c.alive)'))
  b.locator('#leaveButton').click();wait(a,'PlayGame.snapshot().state.phase==="practice"&&PlayGame.snapshot().state.players.length===1');check('leave has no ghost win',a.evaluate('PlayGame.snapshot().state.winnerIds.length')==0)
  b.goto(invite,wait_until='domcontentloaded');b.locator('#startGame').click();wait(b,'PlayGame.snapshot().connected&&PlayGame.snapshot().state.players.length===2');check('invitation rejoins actual room',b.evaluate('PlayGame.snapshot().code')==code);b.locator('#leaveButton').click();a.locator('#leaveButton').click()
  for w,h in [(320,844),(360,780),(390,844),(768,1024),(1280,800)]:a.set_viewport_size({'width':w,'height':h});check('no clipped layout '+str(w),a.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('no browser storage or cookie',a.evaluate('localStorage.length===0&&sessionStorage.length===0&&document.cookie===""'));check('no JS errors',not errors)
  a.goto(base+'/policies.html#topics',wait_until='domcontentloaded');a.wait_for_selector('#policyList .policy-card');check('all100originalsourcecards remain',a.locator('#policyList .policy-card').count()==100)
  browser.close()
 r['status']='passed'
finally:r['checkCount']=len(r['checks']);save()
print(json.dumps({'status':r['status'],'checks':r['checkCount'],'base':base}))
