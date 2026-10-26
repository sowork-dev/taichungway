"""Observe real zero-point self-splashes on two clients; never inject game state."""
import sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8793').rstrip('/');qa=Path(__file__).resolve().parents[1]/'qa';qa.mkdir(exist_ok=True)
r={'status':'incomplete','base':base,'checks':[]}
def save():(qa/'bubble-feedback-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def check(name,ok):r['checks'].append({'name':name,'passed':bool(ok)});save();assert ok,name
save()
try:
 with sync_playwright() as p:
  browser=p.chromium.launch();cs=[browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True) for _ in range(2)];a,b=[c.new_page() for c in cs]
  for c in cs:c.add_init_script('''window.__scoreDraws=[];const original=CanvasRenderingContext2D.prototype.fillText;CanvasRenderingContext2D.prototype.fillText=function(t,...rest){if(/^\\+\\d+$/.test(String(t))&&window.__scoreDraws.length<100)window.__scoreDraws.push(String(t));return original.call(this,t,...rest)}''')
  a.goto(base,wait_until='domcontentloaded');a.locator('#lobbyButton').click();a.locator('#lobbyPractice').click();a.wait_for_function('()=>PlayGame.snapshot().connected');code=a.evaluate('PlayGame.snapshot().code')
  b.goto(base+'/?room='+code,wait_until='domcontentloaded');b.locator('#startGame').click()
  for pg in [a,b]:pg.wait_for_function('()=>PlayGame.snapshot().connected&&PlayGame.snapshot().state.phase==="playing"')
  a.locator('#bombButton').click();a.wait_for_function('()=>PlayGame.snapshot().self.trappedUntil>PlayGame.snapshot().state.now');b.wait_for_function('()=>PlayGame.snapshot().state.events.some(e=>e.type==="capture"&&e.points===0)')
  r['observed']={'aToast':a.locator('#eventToast').inner_text(),'bToast':b.locator('#eventToast').inner_text(),'scores':a.evaluate('PlayGame.snapshot().state.players.map(p=>p.score)')};save()
  check('self splash changes no authoritative score',r['observed']['scores']==[0,0])
  check('self victim sees own-water warning, not a scoring claim','自己的水波' in r['observed']['aToast'] and '+1' not in r['observed']['aToast'] and '＋1' not in r['observed']['aToast'])
  check('unhit opponent is not falsely called the victim','對手' in r['observed']['bToast'] and '+1' not in r['observed']['bToast'] and '＋1' not in r['observed']['bToast'])
  for pg in [a,b]:check('no false canvas score floater '+('A' if pg==a else 'B'),pg.evaluate('window.__scoreDraws.length')==0)
  a.screenshot(path=str(qa/'bubble-self-splash-live.png'));b.locator('#leaveButton').click();a.locator('#leaveButton').click();browser.close()
 r['status']='passed'
finally:r['checkCount']=len(r['checks']);save()
print(json.dumps({'status':r['status'],'checks':r['checkCount'],'base':base}))
