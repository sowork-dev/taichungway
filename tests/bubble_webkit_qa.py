"""Mobile WebKit smoke with actual HTTP/WS; not physical iPhone acceptance."""
import sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8793').rstrip('/');qa=Path(__file__).resolve().parents[1]/'qa';qa.mkdir(exist_ok=True)
r={'status':'incomplete','base':base,'checks':[]}
def save():(qa/'bubble-webkit-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def check(name,ok):r['checks'].append({'name':name,'passed':bool(ok)});save();assert ok,name
save()
try:
 with sync_playwright() as p:
  browser=p.webkit.launch();cs=[browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True) for _ in range(2)];a,b=[c.new_page() for c in cs];errors=[]
  for pg in [a,b]:pg.on('pageerror',lambda e:errors.append(str(e)))
  a.goto(base,wait_until='domcontentloaded');a.locator('#lobbyButton').click();a.locator('#lobbyPractice').click();a.wait_for_function('()=>PlayGame.snapshot().connected&&PlayGame.snapshot().state.kind==="bubble"')
  check('WebKit connects to real bubble engine',True);check('single action visible',a.locator('#gameControls .action-buttons button:visible').count()==1)
  a.locator('#bombButton').tap();a.wait_for_function('()=>PlayGame.snapshot().state.bombs.length===1');check('real touch places a synchronized balloon',True)
  a.wait_for_function('()=>PlayGame.snapshot().state.crates.some(c=>!c.alive)');check('actual water clears a street block',True)
  code=a.evaluate('PlayGame.snapshot().code');b.goto(base+'/?room='+code,wait_until='domcontentloaded');b.locator('#startGame').tap()
  for pg in [a,b]:pg.wait_for_function('()=>PlayGame.snapshot().connected&&PlayGame.snapshot().state.phase==="playing"&&PlayGame.snapshot().state.players.length===2')
  check('two independent WebKit participants share one real room',b.evaluate('PlayGame.snapshot().code')==code)
  check('fair reset on human-slot joining',b.evaluate('PlayGame.snapshot().state.players.every(p=>p.score===0)&&PlayGame.snapshot().state.crates.every(c=>c.alive)'))
  check('whole board fits without camera',a.evaluate('(()=>{let v=PlayGame.snapshot().view;return v.cameraX===0&&v.cameraY===0&&v.y>=0&&v.y+v.height<=v.canvasHeight+1})()'))
  a.screenshot(path=str(qa/'bubble-webkit-live.png'));b.locator('#leaveButton').tap();a.wait_for_function('()=>PlayGame.snapshot().state.phase==="practice"&&PlayGame.snapshot().state.players.length===1');check('disconnect returns to honest practice',True);a.locator('#leaveButton').tap()
  check('no JS errors',not errors);browser.close()
 r['status']='passed'
finally:r['checkCount']=len(r['checks']);save()
print(json.dumps({'status':r['status'],'checks':r['checkCount'],'base':base}))
