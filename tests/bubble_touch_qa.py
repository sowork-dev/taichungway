"""Native Chromium CDP two-finger controls; not a physical-phone/human test."""
import sys,json
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8793').rstrip('/');qa=Path(__file__).resolve().parents[1]/'qa';qa.mkdir(exist_ok=True)
r={'status':'incomplete','base':base,'checks':[]}
def save():(qa/'bubble-touch-results.json').write_text(json.dumps(r,ensure_ascii=False,indent=2))
def check(name,ok):r['checks'].append({'name':name,'passed':bool(ok)});save();assert ok,name
save()
try:
 with sync_playwright() as p:
  b=p.chromium.launch();c=b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True);pg=c.new_page();pg.goto(base);pg.locator('#lobbyButton').click();pg.locator('#lobbyPractice').click();pg.wait_for_function('()=>PlayGame.snapshot().connected');cdp=c.new_cdp_session(pg)
  def center(selector):
   box=pg.locator(selector).bounding_box();return {'x':box['x']+box['width']/2,'y':box['y']+box['height']/2}
  j=center('#moveStick');k=center('#bombButton');x0=pg.evaluate('PlayGame.snapshot().self.x')
  def touch(t,ps):cdp.send('Input.dispatchTouchEvent',{'type':t,'touchPoints':[dict(id=i,x=x,y=y,radiusX=8,radiusY=8,force=1) for i,x,y in ps]})
  touch('touchStart',[(1,j['x'],j['y'])]);touch('touchMove',[(1,j['x']+29,j['y'])]);pg.wait_for_function('x=>PlayGame.snapshot().self.x>x+18',arg=x0)
  check('native touch joystick moves authoritative player',True)
  touch('touchStart',[(1,j['x']+29,j['y']),(2,k['x'],k['y'])]);pg.wait_for_function('()=>PlayGame.snapshot().state.bombs.some(b=>b.ownerId===PlayGame.snapshot().you)')
  check('second finger places balloon while first remains on joystick',True)
  touch('touchEnd',[(1,j['x']+29,j['y'])]);touch('touchEnd',[])
  pg.wait_for_function('()=>PlayGame.snapshot().state.bombs.length===0&&PlayGame.snapshot().self.trappedUntil<=PlayGame.snapshot().state.now',timeout=8000)
  point=pg.evaluate('PlayGame.screenPoint(96,224)');pg.touchscreen.tap(point['x'],point['y']);pg.wait_for_function('()=>Math.hypot(PlayGame.snapshot().self.x-96,PlayGame.snapshot().self.y-224)<8',timeout=8000)
  check('native tap on ground navigates at ordinary speed',True)
  pg.screenshot(path=str(qa/'bubble-touch-live.png'));pg.locator('#leaveButton').click();b.close()
 r['status']='passed'
finally:r['checkCount']=len(r['checks']);save()
print(json.dumps({'status':r['status'],'checks':r['checkCount'],'base':base}))
