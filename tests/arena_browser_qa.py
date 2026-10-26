"""Real action-game E2E. Two automated contexts, not human usability proof."""
import json,sys,time
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791').rstrip('/')
qa=Path(__file__).resolve().parents[1]/'qa';qa.mkdir(exist_ok=True)
report={'status':'incomplete','base':base,'participants':'two independent automated browser contexts','checks':[]}
def persist():(qa/'arena-browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
def check(name,value):
 report['checks'].append({'name':name,'passed':bool(value)});persist()
 assert value,name
persist()
def wait(pg,expr,timeout=15000):
 try:pg.wait_for_function('() => '+expr,timeout=timeout)
 except Exception:
  report['failure']={'expression':expr,'snapshot':pg.evaluate('window.PlayGame?PlayGame.snapshot():null')};pg.screenshot(path=str(qa/'arena-browser-failure.png'));persist();raise
def go(pg,x,y):
 pg.evaluate('([x,y])=>PlayGame.walkTo(x,y)',[x,y])
 wait(pg,'Math.hypot(PlayGame.snapshot().self.x-'+str(x)+',PlayGame.snapshot().self.y-'+str(y)+')<16',timeout=16000)
try:
 with sync_playwright() as p:
  browser=p.chromium.launch();contexts=[browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True) for _ in range(2)]
  contexts[0].add_init_script('Object.defineProperty(navigator,"clipboard",{get:()=>undefined});Object.defineProperty(navigator,"share",{get:()=>undefined});')
  a,b=[c.new_page() for c in contexts];errors=[]
  for pg in [a,b]:pg.on('pageerror',lambda e:errors.append(str(e)))
  a.goto(base,wait_until='domcontentloaded');a.wait_for_selector('#startGame',timeout=12000)
  check('one primary start, no quiz gate',a.locator('#startGame').count()==1 and a.locator('#pkQuestion').count()==0)
  check('AI disclosure persists','非本人' in a.locator('#avatarDisclosure').inner_text())
  check('brief play instruction',len(a.locator('#gameHint').inner_text())<=22)
  a.locator('#startGame').click();wait(a,'window.PlayGame&&PlayGame.snapshot().connected&&PlayGame.snapshot().state.phase==="practice"')
  code=a.evaluate('PlayGame.snapshot().code')
  check('solo starts without room form',a.evaluate('PlayGame.snapshot().state.players.length')==1)
  initial=a.evaluate('PlayGame.snapshot().self');point=a.evaluate('PlayGame.screenPoint(400,640)');a.mouse.click(point['x'],point['y'])
  wait(a,'PlayGame.snapshot().self.carry==="bus"')
  check('actual canvas tap moves and picks supply',a.evaluate('PlayGame.snapshot().self.y')>initial['y'])
  go(a,600,330);wait(a,'PlayGame.snapshot().self.score===100')
  check('solo actual delivery scores',True)
  # Real two-finger mobile input: hold joystick and press dash independently.
  start_x=a.evaluate('PlayGame.snapshot().self.x');sr=a.locator('#moveStick').bounding_box();dr=a.locator('#dashButton').bounding_box();cx=sr['x']+sr['width']/2;cy=sr['y']+sr['height']/2
  cdp=contexts[0].new_cdp_session(a);touch1={'x':cx,'y':cy,'id':1};cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[touch1]});touch1={'x':cx+34,'y':cy,'id':1};cdp.send('Input.dispatchTouchEvent',{'type':'touchMove','touchPoints':[touch1]});wait(a,'PlayGame.snapshot().self.x>'+str(start_x+20))
  check('actual touch joystick moves authoritative player',True)
  touch2={'x':dr['x']+dr['width']/2,'y':dr['y']+dr['height']/2,'id':2};cdp.send('Input.dispatchTouchEvent',{'type':'touchStart','touchPoints':[touch1,touch2]});wait(a,'PlayGame.snapshot().state.events.some(e=>e.type==="dash"&&e.playerId===PlayGame.snapshot().you)');cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[touch1]});cdp.send('Input.dispatchTouchEvent',{'type':'touchEnd','touchPoints':[]})
  check('second finger can dash while joystick is held',True)
  a.locator('#inviteButton').click();a.wait_for_selector('#infoDialog[open] .share-box');invite=a.locator('.share-box').input_value();check('invite contains actual room but no player token',invite==base+'/?room='+code);a.locator('#closeInfo').click()
  a.screenshot(path=str(qa/'arena-solo-live.png'))
  b.goto(base,wait_until='domcontentloaded');b.locator('#lobbyButton').click();b.wait_for_selector('#lobbyDialog[open]')
  wait(b,'document.querySelectorAll("#lobbyRooms [data-room]").length>0')
  b.locator('#lobbyRooms [data-room="'+code+'"]').click()
  for pg in [a,b]:wait(pg,'PlayGame.snapshot().state.players.length===2&&PlayGame.snapshot().state.phase==="playing"')
  check('public lobby joins actual same room',b.evaluate('PlayGame.snapshot().code')==code)
  check('practice points not carried into PK',a.evaluate('PlayGame.snapshot().state.players.every(p=>p.score===0)'))
  check('two peers visibly rendered',a.evaluate('PlayGame.snapshot().state.players.length')==2)
  for i,pg in enumerate([a,b]):check('HUD colour follows actual team '+str(i),pg.evaluate('getComputedStyle(document.querySelector(".self-score")).borderLeftColor===(PlayGame.snapshot().self.team===0?"rgb(56, 140, 187)":"rgb(222, 121, 103)")'))
  check('no credentials exposed',not a.evaluate('JSON.stringify(PlayGame.snapshot()).includes("token")'))
  go(a,400,640);wait(a,'PlayGame.snapshot().self.carry==="bus"');go(a,600,550);go(b,640,550)
  wait(b,'document.querySelector("#tagButton").classList.contains("ready")')
  report['interceptAttempt']={'a':a.evaluate('PlayGame.snapshot().self'),'b':b.evaluate('PlayGame.snapshot().self'),'buttonReady':b.locator('#tagButton').get_attribute('class')};persist()
  b.locator('#tagButton').click();wait(b,'PlayGame.snapshot().self.carry==="bus"')
  wait(a,'PlayGame.snapshot().state.events.some(e=>e.type==="steal")')
  check('real spatial intercept transfers actual carried supply',a.evaluate('PlayGame.snapshot().self.carry')!='bus')
  go(b,600,330);wait(b,'PlayGame.snapshot().self.score===100');wait(a,'PlayGame.snapshot().state.players.some(p=>p.id!==PlayGame.snapshot().you&&p.score===100)')
  check('delivery and peer score truly synchronized',True)
  check('score feedback does not cover own face',b.evaluate('(()=>{const p=PlayGame.snapshot().self,q=PlayGame.screenPoint(p.x,p.y-46),e=document.querySelector("#eventToast"),r=e.getBoundingClientRect();return e.hidden||!(r.left<q.x+14&&r.right>q.x-14&&r.top<q.y+14&&r.bottom>q.y-14)})()'))
  a.screenshot(path=str(qa/'arena-pvp-live-a.png'));b.screenshot(path=str(qa/'arena-pvp-live-b.png'))
  for pg in [a,b]:wait(pg,'PlayGame.snapshot().state.phase==="finished"',timeout=75000)
  check('same winners from server',a.evaluate('PlayGame.snapshot().state.winnerIds')==b.evaluate('PlayGame.snapshot().state.winnerIds'))
  a.locator('#rematchButton').click();b.locator('#rematchButton').click()
  for pg in [a,b]:wait(pg,'PlayGame.snapshot().state.phase==="playing"&&PlayGame.snapshot().self.score===0')
  check('both-peer rematch works',True)
  b.locator('#leaveButton').click();wait(a,'PlayGame.snapshot().state.phase==="practice"&&PlayGame.snapshot().state.players.length===1')
  check('disconnect returns to honest solo without phantom win',a.evaluate('PlayGame.snapshot().state.winnerIds.length')==0)
  b.goto(invite,wait_until='domcontentloaded');b.locator('#startGame').click();wait(b,'PlayGame.snapshot().connected&&PlayGame.snapshot().state.players.length===2');check('actual invite link rejoins intended room',b.evaluate('PlayGame.snapshot().code')==code);b.locator('#leaveButton').click();wait(a,'PlayGame.snapshot().state.players.length===1')
  a.locator('#leaveButton').click()
  for width in [320,360,390,768,1280]:
   a.set_viewport_size({'width':width,'height':844});check('no overflow '+str(width),a.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  check('no browser storage',a.evaluate('localStorage.length===0&&sessionStorage.length===0&&document.cookie===""'))
  check('no browser errors',not errors)
  policy=contexts[0].new_page();policy.goto(base+'/policies.html#topics',wait_until='domcontentloaded');policy.wait_for_selector('#policyList .policy-card')
  check('all100source cards retained outside gameplay',policy.locator('#policyList .policy-card').count()==100)
  browser.close()
 report['status']='passed'
finally:
 report['checkCount']=len(report['checks']);persist()
print(json.dumps({'status':report['status'],'checks':report['checkCount'],'base':base}))
