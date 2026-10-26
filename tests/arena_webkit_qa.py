"""WebKit mobile-engine smoke. Automation, not an iPhone/human test."""
from pathlib import Path
import sys,json
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8791').rstrip('/')
qa=Path(__file__).resolve().parents[1]/'qa';qa.mkdir(exist_ok=True)
r={'status':'incomplete','base':base,'engine':'WebKit automation; not physical iPhone','checks':[]}
def save():(qa/'arena-webkit-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def check(name,value):r['checks'].append({'name':name,'passed':bool(value)});save();assert value,name
def wait(pg,expr):pg.wait_for_function('() => '+expr,timeout=15000)
save()
try:
 with sync_playwright() as p:
  browser=p.webkit.launch();contexts=[browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True) for _ in range(2)];a,b=[c.new_page() for c in contexts];errors=[]
  for pg in [a,b]:pg.on('pageerror',lambda e:errors.append(str(e)))
  a.goto(base,wait_until='domcontentloaded');a.locator('#startGame').click();wait(a,'window.PlayGame&&PlayGame.snapshot().connected&&PlayGame.snapshot().state.phase==="practice"')
  check('mobile WebKit connects without setup',True);code=a.evaluate('PlayGame.snapshot().code')
  q=a.evaluate('PlayGame.screenPoint(400,640)');a.touchscreen.tap(q['x'],q['y']);wait(a,'PlayGame.snapshot().self.carry==="bus"');check('native touch tap navigates to real pickup',True)
  a.evaluate('PlayGame.walkTo(600,330)');wait(a,'PlayGame.snapshot().self.score===100');check('real delivery from WebKit scores on server',True)
  b.goto(base+'/?room='+code,wait_until='domcontentloaded');b.locator('#startGame').click()
  for pg in [a,b]:wait(pg,'PlayGame.snapshot().state.phase==="playing"&&PlayGame.snapshot().state.players.length===2')
  check('two WebKit clients really join same game',b.evaluate('PlayGame.snapshot().code')==code)
  check('both reset practice score at match start',a.evaluate('PlayGame.snapshot().state.players.every(p=>p.score===0)'))
  a.screenshot(path=str(qa/'arena-webkit-mobile.png'));check('no horizontal overflow',a.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  b.locator('#leaveButton').click();wait(a,'PlayGame.snapshot().state.phase==="practice"&&PlayGame.snapshot().state.players.length===1');check('peer leave remains honest solo',True);a.locator('#leaveButton').click()
  a.goto(base+'/policies.html#topics',wait_until='domcontentloaded');a.wait_for_selector('#policyList .policy-card');check('WebKit retains complete secondary100card library',a.locator('#policyList .policy-card').count()==100);check('no JavaScript errors',not errors)
  browser.close()
 r['status']='passed'
finally:r['checkCount']=len(r['checks']);save()
print(json.dumps({'status':r['status'],'checks':r['checkCount'],'base':base}))
