"""End-to-end checks for the supplied-policy city expansion; no mock policies."""
import json, sys
from pathlib import Path
from playwright.sync_api import sync_playwright
BASE = (sys.argv[1] if len(sys.argv)>1 else 'http://127.0.0.1:8767').rstrip('/')
OUT = Path(__file__).resolve().parents[1]/'qa'
OUT.mkdir(exist_ok=True)
checks=[]
def check(name,condition):
    checks.append({'name':name,'passed':bool(condition)})
    if not condition: raise AssertionError(name)
report={'status':'incomplete','base':BASE,'checks':checks}
try:
 with sync_playwright() as p:
  browser=p.chromium.launch()
  context=browser.new_context(viewport={'width':390,'height':844},is_mobile=True,has_touch=True)
  page=context.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto(BASE,wait_until='domcontentloaded')
  page.wait_for_selector('#districtTabs button',timeout=12000)
  check('five accessible districts',page.locator('#districtTabs button').count()==5)
  page.wait_for_function('window.PolicyCatalog && PolicyCatalog.topics.length===15')
  check('full supplied archive source disclosure',page.evaluate('PolicyCatalog.source.kind')=='user-provided-archive')
  check('large world not viewport scaling',page.evaluate('QuestCore.WORLD_WIDTH===3000&&QuestCore.WORLD_HEIGHT===1800'))
  check('original Taichung landmarks loaded',page.evaluate('window.TaichungElements&&TaichungElements.REFERENCES.length===10&&typeof TaichungElements.draw==="function"'))
  check('main scene discloses non-scale map','非比例' in page.locator('#homeView').inner_text())
  check('15 missions for 15 source topics',page.evaluate('new Set(QuestCore.MISSIONS.map(m=>m.topicId)).size===15'))
  check('progress is 15 not old three',page.locator('#questProgress').inner_text()=='0 / 15')
  for width in [360,390,768,1280]:
   page.set_viewport_size({'width':width,'height':844})
   check('no horizontal overflow '+str(width),page.evaluate('document.documentElement.scrollWidth<=innerWidth'))
  page.set_viewport_size({'width':390,'height':844})
  for zone in ['living','innovation','culture','nature','connection']:
   page.locator('#districtTabs [data-zone="'+zone+'"]').click()
   check('district travel '+zone,page.evaluate('QuestGame.snapshot().zoneId')==zone)
   check('travel not endorsement '+zone,page.locator('#questProgress').inner_text()=='0 / 15')
  page.locator('#openCityMap').click();page.wait_for_selector('#cityMapDialog[open]')
  check('city atlas lists all topics',page.locator('#atlasMissions [data-travel]').count()==15)
  for mission in page.locator('#atlasMissions [data-travel]').evaluate_all('(bs)=>bs.map(b=>b.dataset.travel)'):
   page.locator('#atlasMissions [data-travel="'+mission+'"]').click()
   check('fast travel reaches exact mission '+mission,page.evaluate('(id)=>{const m=QuestCore.MISSIONS.find(m=>m.id===id),s=QuestGame.snapshot();return s.x===m.x&&s.y===m.y}',mission))
   page.locator('#avatarButton').click();page.wait_for_selector('#questDialog[open]')
   check('mission has readable sourced card '+mission,page.locator('#policySkills [data-policy]').count()>0)
   page.locator('#policySkills [data-policy]').first.click();page.locator('#activatePolicy').click()
   page.wait_for_selector('#questDialog[data-phase="review"]',timeout=8000)
   check('source remains traceable '+mission,page.locator('#questSource').get_attribute('href').startswith('https://'))
   check('AI disclosure in mission '+mission,'非本人即時回覆' in page.locator('#questDialog').inner_text())
   page.locator('#closeQuest').click();page.locator('#openCityMap').click()
  page.locator('#closeCityMap').click()
  page.locator('[data-view="topics"]').click()
  check('complete policy library not 12 only',page.locator('#policyList .policy-card').count()>27)
  for keyword in ['RSV','凍卵','臨托','動物','客家','原住民']:
   page.locator('#topicSearch').fill(keyword)
   check('source detail searchable '+keyword,page.locator('#policyList .policy-card').count()>0)
  page.locator('#topicSearch').fill('')
  check('archive provenance visible in library','提供文件' in page.locator('#policyList').inner_text())
  page.locator('[data-view="home"]').click();page.locator('#openPk').click()
  page.wait_for_selector('#pkDialog[open]')
  check('PK explains opt-in data transfer','暫存' in page.locator('#pkDialog').inner_text())
  check('no fake live opponent on entry',page.locator('#pkPlayers').locator('.pk-player').count()==0)
  check('no browser errors',not errors)
  page.locator('#closePk').click();page.screenshot(path=str(OUT/'world-live-city.png'))
  browser.close()
 report['status']='passed'
finally:
 report['checkCount']=len(checks)
 (OUT/'world-browser-results.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps({'status':report['status'],'checks':len(checks),'base':BASE}))
