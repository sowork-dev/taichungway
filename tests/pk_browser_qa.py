"""Real two-independent-browser policy PK acceptance. No fake opponents."""
import json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8789').rstrip('/')
out=Path(__file__).resolve().parents[1]/'qa';out.mkdir(exist_ok=True)
checks=[];report={'status':'incomplete','base':base,'checks':checks,'participantType':'two isolated automated browser contexts; not human acceptance'}
def check(name,value):
 checks.append({'name':name,'passed':bool(value)})
 if not value:raise AssertionError(name)
try:
 with sync_playwright() as p:
  b=p.chromium.launch();contexts=[b.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True) for _ in range(2)]
  a,z=[c.new_page() for c in contexts];errors=[]
  for pg in [a,z]:pg.on('pageerror',lambda e:errors.append(str(e)))
  a.goto(base,wait_until='domcontentloaded');a.wait_for_selector('#openPk',timeout=12000);a.locator('#openPk').click()
  a.locator('#pkNickname').fill('測試甲');a.locator('#pkCreate').click()
  a.wait_for_function('() => window.PolicyPK&&PolicyPK.snapshot()?.code')
  code=a.locator('#pkRoomCode').inner_text().strip()
  check('shareable real room code',len(code)==6 and code.isalnum())
  check('waiting does not fake player',a.locator('#pkPlayers .pk-player').count()==1)
  z.goto(base+'/?room='+code,wait_until='domcontentloaded');z.wait_for_selector('#pkDialog[open]')
  check('invite opens exact room input',z.locator('#pkJoinCode').input_value()==code)
  z.locator('#pkNickname').fill('測試乙');z.locator('#pkJoin').click()
  for pg in [a,z]:pg.wait_for_function('() => PolicyPK.snapshot()?.players.length===2')
  check('two actual contexts share room',z.locator('#pkRoomCode').inner_text().strip()==code)
  for pg in [a,z]:
   check('no token exposed in public client snapshot',not pg.evaluate('JSON.stringify(PolicyPK.snapshot()).includes("token")'))
  a.locator('#closePk').click();a.locator('#districtTabs [data-zone="nature"]').click()
  z.wait_for_function('() => PolicyPK.snapshot().players.some(p=>p.nickname==="測試甲"&&p.zoneId==="nature")',timeout=10000)
  check('peer position really synchronized',True)
  a.locator('#openPk').click();a.locator('#pkReady').click()
  check('single readiness does not start',a.evaluate('PolicyPK.snapshot().status')=='waiting')
  z.locator('#pkReady').click()
  for pg in [a,z]:pg.wait_for_function('() => PolicyPK.snapshot()?.status==="playing"')
  check('both ready starts same round',a.evaluate('PolicyPK.snapshot().round.id')==z.evaluate('PolicyPK.snapshot().round.id'))
  for n in range(1,6):
   for pg in [a,z]:pg.wait_for_function('(n)=>PolicyPK.snapshot()?.status==="playing"&&PolicyPK.snapshot().round.index===n',arg=n,timeout=16000)
   check('same question '+str(n),a.locator('#pkQuestion').inner_text()==z.locator('#pkQuestion').inner_text())
   check('four real choices '+str(n),a.locator('#pkChoices button').count()==4)
   a.locator('#pkChoices button').nth(0).click()
   a.wait_for_function('() => PolicyPK.snapshot().round.answered.includes(PolicyPK.snapshot().you)')
   check('own answer locks '+str(n),all(a.locator('#pkChoices button').nth(i).is_disabled() for i in range(4)))
   check('answer not revealed before peer '+str(n),a.evaluate('PolicyPK.snapshot().round.result===null'))
   z.locator('#pkChoices button').nth(1).click()
   for pg in [a,z]:pg.wait_for_function('() => PolicyPK.snapshot()?.status==="round-result"')
   check('server result shared '+str(n),a.evaluate('PolicyPK.snapshot().round.result.correctIndex')==z.evaluate('PolicyPK.snapshot().round.result.correctIndex'))
   check('round source visible '+str(n),a.locator('#pkSource').get_attribute('href').startswith('https://taichung.sowork.ai/'))
   check('not political approval scoring '+str(n),'理解' in a.locator('#pkDisclosure').inner_text())
   check('same server scores '+str(n),a.evaluate('PolicyPK.snapshot().players.map(p=>p.score)')==z.evaluate('PolicyPK.snapshot().players.map(p=>p.score)'))
  for pg in [a,z]:pg.wait_for_function('() => PolicyPK.snapshot()?.status==="finished"',timeout=16000)
  check('five rounds finish with outcome',bool(a.locator('#pkOutcome').inner_text().strip()))
  check('winner IDs agree',a.evaluate('PolicyPK.snapshot().winnerIds')==z.evaluate('PolicyPK.snapshot().winnerIds'))
  a.screenshot(path=str(out/'pk-live-result-a.png'));z.screenshot(path=str(out/'pk-live-result-b.png'))
  a.locator('#pkRematch').click();z.locator('#pkRematch').click()
  for pg in [a,z]:pg.wait_for_function('() => PolicyPK.snapshot()?.status==="playing"&&PolicyPK.snapshot().round.index===1',timeout=12000)
  check('real rematch resets scores',a.evaluate('PolicyPK.snapshot().players.every(p=>p.score===0)'))
  z.locator('#pkLeave').click();a.wait_for_function('() => PolicyPK.snapshot()?.status==="waiting"&&PolicyPK.snapshot().players.length===1')
  check('leave never awards phantom win',a.evaluate('PolicyPK.snapshot().winnerIds.length===0'))
  a.locator('#pkLeave').click()
  check('all pages remain storage free',all(pg.evaluate('localStorage.length===0&&sessionStorage.length===0&&document.cookie===""') for pg in [a,z]))
  check('no browser errors',not errors)
  b.close()
 report['status']='passed'
finally:
 report['checkCount']=len(checks);(out/'pk-browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'status':report['status'],'checks':len(checks),'base':base}))
