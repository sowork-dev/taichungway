from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts/policy-play'
cases=json.loads((OUT/'cases.json').read_text())
assert len(cases)==34 and len({c['id'] for c in cases})==34
files=sorted((OUT/'card-layouts').glob('*.svg'))
assert {f.stem for f in files}=={c['id'] for c in cases}
rows=[]
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page()
 for file in files:
  page.set_content(file.read_text())
  svg=page.locator('body > svg')
  bounds=svg.evaluate('(svg)=>{const r=svg.getBBox();return {x:r.x,y:r.y,width:r.width,height:r.height}}')
  passed=bounds['x']>=-1 and bounds['y']>=-1 and bounds['x']+bounds['width']<=1081 and bounds['y']+bounds['height']<=1351
  assert '江啟臣政見・非施政成果' in svg.locator('title').text_content()
  rows.append({'variant':file.stem,'bounds':bounds,'passed':passed})
 browser.close()
report={'expected':34,'cases':rows,'passed':sum(row['passed'] for row in rows),'failed':sum(not row['passed'] for row in rows)}
(OUT/'card-bounds-qa.json').write_text(json.dumps(report,ensure_ascii=False,indent=2))
print(json.dumps(report,ensure_ascii=False,indent=2))
assert report['failed']==0
