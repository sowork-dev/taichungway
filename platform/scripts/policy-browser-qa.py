"""Real policy-state interactions; desktop Chromium mobile viewport, not physical LINE."""
import os,json,traceback
from pathlib import Path
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_ORIGIN','http://127.0.0.1:4189').rstrip('/')
OUT=ROOT/'artifacts'/os.environ.get('ARTIFACT_SUBDIR','policy-play/local')
OUT.mkdir(parents=True,exist_ok=True)
report={'origin':BASE,'cases':[],'physicalLineTested':False}
def case(name,fn):
 try:
  evidence=fn();report['cases'].append({'name':name,'status':'passed','evidence':evidence})
  print('PASSED',name,flush=True)
 except Exception as e:
  report['cases'].append({'name':name,'status':'failed','error':str(e),'traceback':traceback.format_exc()})
  print('FAILED',name,traceback.format_exc(),flush=True)
 finally:(OUT/'policy-browser-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
with sync_playwright() as p:
 browser=p.chromium.launch()
 ctx=browser.new_context(viewport={'width':390,'height':844},permissions=['clipboard-read','clipboard-write'])
 page=ctx.new_page();errors=[];requests=[]
 page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('request',lambda r:requests.append({'url':r.url,'method':r.method,'body':r.post_data}))
 def fortune():
  rows=[]
  for value,title,name in [(0,'打造全齡友善人本道路','walk'),(.75,'公有市場裝冷氣，打造特色市場','market')]:
   page.goto(BASE+'/fortune/',wait_until='networkidle')
   page.evaluate('(first)=>{window.__oldRandom=Math.random;const values=[first,.46];Math.random=()=>values.length?values.shift():.1;}',value)
   page.get_by_test_id('fortune-tap').click();page.get_by_test_id('policy-reveal').wait_for()
   page.evaluate('Math.random=window.__oldRandom')
   assert page.get_by_role('button',name='下載圖卡').count()==0, 'do not export a wish before the proposal is revealed'
   page.get_by_test_id('policy-reveal').click()
   page.get_by_role('heading',name=f'「{title}」',exact=True).wait_for()
   assert page.locator('#result-card a[href="https://taichungway.tw/future"]').count()>=1
   page.locator('#nickname').fill('測試暱稱')
   with page.expect_download(timeout=45000) as waiting:page.get_by_role('button',name='下載圖卡').click()
   dest=OUT/f'fortune-{name}.png';waiting.value.save_as(dest)
   from PIL import Image
   assert Image.open(dest).size==(1080,1350)
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page.evaluate("window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(OUT/f'fortune-{name}-revealed.png'),full_page=True)
   page.get_by_role('button',name='再沾一次').click()
   assert page.get_by_test_id('result-card').count()==0
   rows.append({'policy':title,'download':str(dest),'replayCleared':True})
  return rows
 case('fortune-two-proposals-reveal-export-replay',fortune)
 def market():
  rows=[]
  for width in [360,390,768]:
   page.set_viewport_size({'width':width,'height':844})
   page.goto(BASE+'/flavor/',wait_until='networkidle');page.get_by_role('button',name='開始測驗').click()
   page.get_by_test_id('answer-0').click();page.get_by_test_id('market-cool').wait_for()
   assert page.get_by_test_id('market-continue').is_disabled()
   assert page.get_by_text('概念示意，不是實測結果',exact=True).count()>=1
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if width==390:page.evaluate("window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(OUT/'market-before.png'),full_page=True)
   switch=page.get_by_test_id('market-cool');switch.click()
   assert switch.get_attribute('aria-pressed')=='true'
   page.get_by_role('heading',name='「公有市場裝冷氣，打造特色市場」',exact=True).wait_for()
   assert not page.get_by_test_id('market-continue').is_disabled()
   assert page.evaluate('document.documentElement.scrollWidth<=innerWidth')
   if width==390:page.evaluate("window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(OUT/'market-after.png'),full_page=True)
   switch.click();assert switch.get_attribute('aria-pressed')=='false'
   # Once understood, compare freely without losing the source explanation or progress.
   assert page.get_by_role('heading',name='「公有市場裝冷氣，打造特色市場」',exact=True).is_visible()
   switch.click();page.get_by_test_id('market-continue').click()
   page.get_by_test_id('answer-0').wait_for();page.get_by_test_id('answer-0').click()
   page.get_by_test_id('answer-0').wait_for();page.get_by_test_id('answer-0').click()
   card=page.get_by_test_id('result-card');card.wait_for()
   assert '公有市場裝冷氣，打造特色市場' in card.inner_text()
   assert card.locator('a[href="https://taichungway.tw/future"]').count()>=1
   if width==390:
    page.locator('#nickname').fill('市場小實驗')
    with page.expect_download(timeout=45000) as waiting:page.get_by_role('button',name='下載圖卡').click()
    dest=OUT/'flavor-market.png';waiting.value.save_as(dest)
    page.evaluate("window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(OUT/'flavor-result.png'),full_page=True)
   page.get_by_role('button',name='再玩一次').click();page.get_by_role('button',name='開始測驗').click();page.get_by_test_id('answer-0').click()
   page.get_by_test_id('market-cool').wait_for();assert page.get_by_test_id('market-continue').is_disabled()
   rows.append({'width':width,'offOnComparison':True,'replayResetsExperiment':True})
  return rows
 case('market-off-on-compare-source-result-replay-three-widths',market)
 def privacy():
  assert not errors,errors
  assert ctx.cookies()==[]
  assert page.evaluate('localStorage.length+sessionStorage.length')==0
  offending=[r for r in requests if r['method']!='GET' or r['body'] or not(r['url'].startswith(BASE+'/') or r['url'].startswith('blob:'+BASE+'/'))]
  assert not offending,offending[:5]
  return {'pageErrors':0,'cookies':0,'persistentStorageKeys':0,'noExternalOrInputRequests':True}
 case('policy-game-privacy-and-no-page-errors',privacy)
 ctx.close();browser.close()
report['passed']=sum(c['status']=='passed' for c in report['cases'])
report['failed']=sum(c['status']=='failed' for c in report['cases'])
(OUT/'policy-browser-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
raise SystemExit(1 if report['failed'] else 0)
