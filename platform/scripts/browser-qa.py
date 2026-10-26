"""Exercise built Phase1 via real Chromium/WebKit. Not physical LINE acceptance."""
import os, json, itertools, gzip, time, traceback
from pathlib import Path
from urllib.parse import urlparse
from collections import Counter
from playwright.sync_api import sync_playwright
ROOT=Path(__file__).resolve().parents[1]
BASE=os.environ.get('TEST_ORIGIN','http://127.0.0.1:4189').rstrip('/')
OUT=ROOT/'artifacts'/os.environ.get('ARTIFACT_SUBDIR','local');OUT.mkdir(parents=True,exist_ok=True)
SHOTS=OUT/'screenshots';SHOTS.mkdir(exist_ok=True)
REPORT={'origin':BASE,'cases':[],'physicalLineTested':False,'physicalPhoneTested':False}
def case(name,fn):
 try:
  value=fn();status='skipped' if isinstance(value,dict) and 'skipped' in value else 'passed';REPORT['cases'].append({'name':name,'status':status,'evidence':value});print(status.upper(),name,flush=True)
 except Exception as e:
  REPORT['cases'].append({'name':name,'status':'failed','error':str(e),'traceback':traceback.format_exc()});print('FAIL',name,traceback.format_exc(),flush=True)
 finally:(OUT/'browser-qa.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2))
def start_quiz(page):
 page.goto(BASE+'/flavor/',wait_until='networkidle')
 if not page.get_by_test_id('answer-0').is_visible():page.get_by_role('button',name='開始測驗').click()
 page.get_by_test_id('answer-0').wait_for()
def answer(page,choices):
 for i,choice in enumerate(choices):
  page.get_by_test_id(f'answer-{choice}').click()
  if i==0:
   page.get_by_test_id('market-cool').wait_for()
   assert page.get_by_test_id('market-continue').is_disabled(), 'market experiment must be played before continuing'
   page.get_by_test_id('market-cool').click()
   page.get_by_role('heading',name='「公有市場裝冷氣，打造特色市場」',exact=True).wait_for()
   assert page.locator('a[href="https://taichungway.tw/future"]').count()>=1
   page.get_by_test_id('market-continue').click()
  if i<2:page.get_by_test_id('answer-0').wait_for()
 page.get_by_test_id('result-card').wait_for()
 return page.get_by_test_id('result-card').inner_text()
with sync_playwright() as p:
 browser=p.chromium.launch()
 ctx=browser.new_context(viewport={'width':390,'height':844},device_scale_factor=1,permissions=['clipboard-read','clipboard-write'])
 page=ctx.new_page();errors=[];requests=[];page.on('request',lambda request:requests.append({'url':request.url,'method':request.method,'body':request.post_data}));page.on('pageerror',lambda e:errors.append(str(e)))
 page.on('console',lambda msg:errors.append(msg.text)if msg.type=='error'else None)
 def layouts():
  for width in [360,390,768]:
   page.set_viewport_size({'width':width,'height':844})
   for route in ['/','/fortune/','/flavor/','/privacy/']:
    page.goto(BASE+route,wait_until='networkidle')
    assert page.evaluate('document.documentElement.scrollWidth<=innerWidth'),(width,route,'overflow')
    assert page.locator('html').get_attribute('lang')=='zh-Hant-TW'
    assert page.get_by_text('SoWork 獨立互動預覽，非官方網站；尚未取得競選團隊授權或背書。',exact=True).count()==1
    if width==390:page.evaluate("window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(SHOTS/(route.strip('/').replace('/','-')or'hub'))+'.png',full_page=True)
  page.set_viewport_size({'width':390,'height':844})
  return {'widths':[360,390,768],'routes':4}
 case('responsive-four-routes',layouts)
 def hub():
  page.goto(BASE+'/',wait_until='networkidle')
  assert page.locator('main a[href*="utm_source=hub"]').count()==2
  for title in ['對開支票本','沾福氣','你是哪一味','替他說一句','台中聲音明信片','巷口四格漫畫','台中機器']:assert page.get_by_text(title,exact=True).count()>=1,title
  return {'liveCards':2,'soonCards':5}
 case('hub-seven-cards',hub)
 def runtime_status():
  if not BASE.startswith('http://127.0.0.1:'):return {'skipped':'status mutation is local-only'}
  file=ROOT/'data/sites.json';original=file.read_text();data=json.loads(original)
  try:
   for row in data:
    if row['id']=='fortune':row['status']='soon'
   file.write_text(json.dumps(data,ensure_ascii=False));page.evaluate('window.dispatchEvent(new Event("focus"))')
   page.wait_for_function('()=>document.querySelectorAll(\'main a[href*="utm_source=hub"]\').length===1')
   assert page.locator('footer a[href*="/fortune/"]').count()==0
  finally:file.write_text(original);page.evaluate('window.dispatchEvent(new Event("focus"))')
  page.wait_for_function('()=>document.querySelectorAll(\'main a[href*="utm_source=hub"]\').length===2')
  return {'changed':'fortune live→soon→live without rebuild'}
 case('sites-json-runtime-down-and-up',runtime_status)
 def large():
  page.goto(BASE+'/fortune/',wait_until='networkidle');button=page.get_by_role('button',name='大字模式');button.click();assert button.get_attribute('aria-pressed')=='true'
  small=page.evaluate('''Array.from(document.querySelectorAll('p,button,a,input,label,small')).filter(e=>e.getBoundingClientRect().width>1&&getComputedStyle(e).visibility!=='hidden'&&parseFloat(getComputedStyle(e).fontSize)<16).map(e=>({text:e.textContent,size:getComputedStyle(e).fontSize}))''')
  assert not small,small
  page.reload(wait_until='networkidle');assert page.get_by_role('button',name='大字模式').get_attribute('aria-pressed')=='false'
  return {'largeMode':'in-memory only','visibleTextMinimumPx':16}
 case('large-mode-and-readable-copy',large)
 def fortune_cancel():
  page.goto(BASE+'/fortune/',wait_until='networkidle');hold=page.get_by_test_id('hold-button');hold.scroll_into_view_if_needed();box=hold.bounding_box();assert box
  page.mouse.move(box['x']+box['width']/2,box['y']+box['height']/2);page.mouse.down();page.wait_for_timeout(80)
  count=page.get_by_test_id('fortune-particle').count();assert 0<count<=60,count
  hold.dispatch_event('pointercancel',{'pointerId':1,'isPrimary':True});page.mouse.up();page.wait_for_timeout(1700);assert page.get_by_test_id('result-card').count()==0
  page.mouse.down();page.wait_for_timeout(1650);page.mouse.up();page.get_by_test_id('result-card').wait_for();return {'particlesAt80ms':count,'cancelDidNotCreateCard':True,'holdCreatesCard':True}
 case('fortune-pointer-cancel-and-full-hold',fortune_cancel)
 def fortune_export():
  page.goto(BASE+'/fortune/',wait_until='networkidle');page.get_by_test_id('fortune-tap').click();page.get_by_test_id('result-card').wait_for();page.get_by_test_id('policy-reveal').click();page.locator('#nickname').fill('小王')
  with page.expect_download(timeout=45000) as waiting:page.get_by_role('button',name='下載圖卡').click()
  download=waiting.value;dest=OUT/'fortune-card.png';download.save_as(dest)
  from PIL import Image
  im=Image.open(dest);assert im.size==(1080,1350);assert im.getextrema()!=(0,0)
  page.get_by_role('button',name='分享連結').click();page.get_by_text('已複製遊戲連結，不含暱稱與作答。',exact=True).wait_for(timeout=30000);link=page.evaluate('navigator.clipboard.readText()');assert '/fortune/?utm_' in link and '小王' not in link
  page.evaluate("window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(SHOTS/'fortune-result.png'),full_page=True)
  return {'download':str(dest),'dimensions':list(im.size),'shareUrl':link}
 case('fortune-tap-real-png-and-clipboard',fortune_export)
 def combinations():
  names=['老市場味','山城茶香味','海線海風味','屯區新家味','舊城文青味','港口遠航味','田裡實在味','黑手職人味'];counts=Counter();rows=[]
  choices_set=list(itertools.product(range(4),repeat=3))
  if BASE.startswith('https://'):
   local=json.loads(Path(os.environ.get('LOCAL_FLAVOR_EVIDENCE',str(ROOT/'artifacts/local/browser-flavor-64.json'))).read_text());first={}
   for row in local:first.setdefault(row['result'],row['answers'])
   assert len(first)==8;choices_set=list(first.values())
  for choices in choices_set:
   start_quiz(page);text=answer(page,choices);hits=[name for name in names if name in text];assert len(hits)==1,(choices,text);counts[hits[0]]+=1;rows.append({'answers':choices,'result':hits[0]})
  assert len(counts)==8,counts
  if len(choices_set)==64:assert max(counts.values())/64<=.35,counts
  (OUT/f'browser-flavor-{len(choices_set)}.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
  page.evaluate("window.scrollTo({top:0,behavior:'instant'})");page.screenshot(path=str(SHOTS/'flavor-result.png'),full_page=True)
  return {'combinations':len(choices_set),'distribution':dict(counts)}
 case('quiz-eight-public-results'if BASE.startswith('https://')else'quiz-all-64-ui-paths-eight-reachable',combinations)
 def flavor_export():
  start_quiz(page);answer(page,[0,0,0]);page.locator('#nickname').fill('小茶')
  with page.expect_download(timeout=45000)as waiting:page.get_by_role('button',name='下載圖卡').click()
  dest=OUT/'flavor-card.png';waiting.value.save_as(dest)
  from PIL import Image
  assert Image.open(dest).size==(1080,1350)
  page.get_by_role('button',name='再玩一次').click();page.get_by_role('button',name='開始測驗').click();page.get_by_test_id('answer-0').wait_for();assert page.get_by_test_id('result-card').count()==0
  return {'download':str(dest),'replay':'restarted'}
 case('flavor-real-png-and-replay',flavor_export)
 def no_storage():
  assert ctx.cookies()==[]
  assert page.evaluate('localStorage.length+sessionStorage.length')==0
  unexpected=[row for row in requests if not (row['method']=='GET' and not row['body'] and (row['url'].startswith(BASE+'/') or row['url'].startswith('blob:'+BASE+'/')))]
  assert not unexpected,unexpected[:10]
  personal=[row for row in requests if 'nickname=' in row['url'] or 'answers=' in row['url']]
  assert not personal,personal[:10]
  return {'cookies':0,'storageKeys':0,'requestsChecked':len(requests),'userInputRequests':0}
 case('no-cookies-or-persistent-storage',no_storage)
 def budgets():
  totals={}
  for route in ['/','/fortune/','/flavor/']:
   scripts={}
   def collect(response):
    if response.request.resource_type=='script':scripts[response.url]=len(gzip.compress(response.body()))
   page.on('response',collect);page.goto(BASE+route,wait_until='networkidle');page.remove_listener('response',collect)
   assert sum(scripts.values())<=200*1024,(route,sum(scripts.values()))
   totals[route]={'initialJsGzipBytes':sum(scripts.values()),'scriptCount':len(scripts)}
  return totals
 case('initial-javascript-gzip-budget',budgets)
 def no_error():assert not errors,errors;return {'browserErrors':0}
 case('chromium-no-console-or-hydration-errors',no_error)
 ctx.close();browser.close()
 def webkit():
  browser=p.webkit.launch();context=browser.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');page2=context.new_page()
  try:
   page2.goto(BASE+'/fortune/',wait_until='networkidle');page2.get_by_test_id('fortune-tap').click();page2.get_by_test_id('result-card').wait_for()
   start_quiz(page2);answer(page2,[1,1,1]);assert page2.evaluate('document.documentElement.scrollWidth<=innerWidth')
   page2.screenshot(path=str(SHOTS/'webkit-flavor-result.png'),full_page=True)
  finally:context.close();browser.close()
  return {'engine':'WebKit','reducedMotion':'reduce','flows':['fortune','flavor'],'physicalSafari':False}
 case('webkit-reduced-motion-two-flows',webkit)
REPORT['passed']=sum(row['status']=='passed'for row in REPORT['cases']);REPORT['failed']=sum(row['status']=='failed'for row in REPORT['cases']);REPORT['complete']=REPORT['failed']==0
(OUT/'browser-qa.json').write_text(json.dumps(REPORT,ensure_ascii=False,indent=2));print(json.dumps(REPORT,ensure_ascii=False,indent=2))
raise SystemExit(1 if REPORT['failed'] else 0)
