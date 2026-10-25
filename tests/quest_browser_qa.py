"""Exercise the approved policy-as-mission loop, not just a game-shaped home screen."""
import atexit,json,sys
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8767').rstrip('/')
out=Path(__file__).resolve().parents[1]/'qa'
out.mkdir(exist_ok=True)
report={'base':base,'status':'incomplete','checks':[]}
path=out/'quest-browser-results.json'
def persist():path.write_text(json.dumps(report,ensure_ascii=False,indent=2))
atexit.register(persist);persist()
def check(name,condition):
 report['checks'].append({'name':name,'passed':bool(condition)})
 assert condition,name
with sync_playwright() as p:
 browser=p.chromium.launch(headless=True)
 context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
 page=context.new_page();errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.goto(base,wait_until='networkidle')
 check('original interactive city exists',page.locator('#questCanvas').count()==1)
 page.wait_for_selector('#homeTopics .topic-tile')
 check('three missions, independently specified',page.locator('#homeTopics [data-mission]').evaluate_all('(els)=>els.map(x=>x.dataset.mission).sort()')==['care','childcare','commute'])
 check('AI and non-live-person disclosure remains', '非江啟臣本人即時回覆' in page.locator('.disclosure').inner_text())
 check('scene explicitly illustrative', '情境示意' in page.locator('#homeView').inner_text())
 for width in [320,360,390,430,768,1280]:
  page.set_viewport_size({'width':width,'height':844})
  check('no horizontal overflow '+str(width),page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
  rect=page.locator('#questCanvas').bounding_box()
  check('city visible '+str(width),rect['width']>250 and rect['height']>250)
 page.set_viewport_size({'width':390,'height':844})
 page.screenshot(path=str(out/'quest-city-mobile.png'),full_page=True)
 start=page.evaluate('QuestGame.snapshot()')
 page.keyboard.down('ArrowRight');page.wait_for_timeout(320);page.keyboard.up('ArrowRight')
 after=page.evaluate('QuestGame.snapshot()')
 check('keyboard actually moves character',after['x']>start['x']+15)
 page.locator('#questPause').click();paused=page.evaluate('QuestGame.snapshot()')
 page.keyboard.down('ArrowDown');page.wait_for_timeout(250);page.keyboard.up('ArrowDown')
 check('pause stops character',page.evaluate('QuestGame.snapshot().y')==paused['y'])
 page.locator('#questResume').click()
 # Real pointer events on virtual joystick, not a direct call to movement logic.
 rect=page.locator('#questJoystick').bounding_box();cx=rect['x']+rect['width']/2;cy=rect['y']+rect['height']/2
 page.mouse.move(cx,cy);page.mouse.down();page.mouse.move(cx,cy+30);page.wait_for_timeout(320);page.mouse.up()
 check('virtual joystick actually moves character',page.evaluate('QuestGame.snapshot().y')>paused['y']+15)
 page.locator('#questReset').click()
 check('reset returns to spawn',page.evaluate('QuestGame.snapshot().x')==300 and page.evaluate('QuestGame.snapshot().y')==520)
 seen=[]
 for mission in ['commute','childcare','care']:
  page.locator('#homeTopics [data-mission="'+mission+'"]').click()
  page.wait_for_selector('#questDialog[open]',timeout=18000)
  check('arrival opens mission '+mission,page.locator('#questDialog').get_attribute('data-mission')==mission)
  check('choose phase '+mission,page.locator('#questDialog').get_attribute('data-phase')=='choose')
  check('AI disclaimer visible inside mission '+mission,'非本人即時回覆' in page.locator('#questDialog').inner_text())
  check('no completion before review '+mission,mission not in page.evaluate('QuestGame.snapshot().completed'))
  page.locator('#policySkills [data-policy]').first.click()
  policy_id=page.locator('#policySkills .selected').get_attribute('data-policy')
  check('selected card is allowed '+mission,policy_id in page.evaluate('QuestCore.MISSIONS.find(m=>m.id==='+json.dumps(mission)+').policyIds'))
  page.locator('#activatePolicy').click()
  page.wait_for_selector('#questDialog[data-phase="review"]',timeout=8000)
  check('mechanism label, not measured policy effect '+mission,'非實測成效' in page.locator('#questDialog').inner_text())
  check('card source retained '+mission,page.locator('#questReview a').get_attribute('href').startswith('https://'))
  if mission=='commute':
   page.screenshot(path=str(out/'quest-mechanism-mobile.png'),full_page=True)
   page.locator('[data-meta="cost"]').click()
   page.wait_for_selector('#chatDialog[open]')
   check('budget question not invented','未確認' in page.locator('#messages').inner_text() and '預算' in page.locator('#messages').inner_text())
   page.locator('#closeChat').click();page.wait_for_selector('#questDialog[open]')
   check('return from question preserves review',page.locator('#questDialog').get_attribute('data-phase')=='review')
  page.locator('#completeMission').click()
  page.wait_for_selector('#questDialog[open]',state='hidden')
  seen.append(mission)
  check('understanding progress, not voting score '+mission,set(page.evaluate('QuestGame.snapshot().completed'))==set(seen))
 check('all three mission loop completed',page.locator('#questProgress').inner_text()=='3 / 3')
 # Freeze the expected policy-card denominator independently of the UI list.
 expected_cards={'commute':['transport-public-transit','transport-smart-roads'],'childcare':['parenting-childcare','parenting-family-support'],'care':['senior-care-single-window']}
 for mission,card_ids in expected_cards.items():
  for card_id in card_ids:
   page.locator('#homeTopics [data-mission="'+mission+'"]').click()
   page.wait_for_selector('#questDialog[open]',timeout=18000)
   page.locator('#policySkills [data-policy="'+card_id+'"]').click()
   page.locator('#activatePolicy').click()
   page.wait_for_selector('#questDialog[data-phase="review"]',timeout=8000)
   source=page.evaluate('records.find(r=>r.id==='+json.dumps(card_id)+').sourceUrl')
   check('exact source for every skill '+card_id,page.locator('#questSource').get_attribute('href')==source)
   for facet in ['cost','timeline','eligibility']:
    page.locator('[data-meta="'+facet+'"]').click();page.wait_for_selector('#chatDialog[open]')
    check('bounded follow-up '+card_id+' '+facet,'目前收錄資料未確認' in page.locator('#messages .message:not(.user)').last.inner_text())
    page.locator('#closeChat').click();page.wait_for_selector('#questDialog[open]')
    check('review survives follow-up '+card_id+' '+facet,page.locator('#questDialog').get_attribute('data-phase')=='review')
   page.locator('#closeQuest').click()
 check('all skill revisits preserve exact progress',len(page.evaluate('QuestGame.snapshot().completed'))==3)
 # Revisit and close: never duplicate completion or imply user endorsement.
 page.locator('#homeTopics [data-mission="care"]').click();page.wait_for_selector('#questDialog[open]',timeout=18000)
 page.locator('#closeQuest').click()
 check('exit without false completion',len(page.evaluate('QuestGame.snapshot().completed'))==3)
 page.locator('#helloButton').click();page.wait_for_selector('#chatDialog[open]')
 page.locator('#question').fill('對木星移民的政策是什麼？');page.locator('#sendButton').click()
 check('free-question unsupported stance remains unknown','資料還不足' in page.locator('#messages').inner_text())
 page.locator('#closeChat').click()
 page.reload(wait_until='domcontentloaded');page.wait_for_selector('#homeTopics .topic-tile')
 check('progress is session memory only',page.evaluate('QuestGame.snapshot().completed.length')==0)
 check('no persistent storage',page.evaluate('localStorage.length===0 && sessionStorage.length===0'))
 check('no JavaScript errors',not errors)
 browser.close()
report.update(status='passed',checkCount=len(report['checks']))
persist();print(json.dumps({'status':report['status'],'checks':report['checkCount'],'base':base},ensure_ascii=False))
