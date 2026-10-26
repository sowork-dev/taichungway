from pathlib import Path
from playwright.sync_api import sync_playwright
import json
ROOT=Path(__file__).resolve().parents[1]
files=sorted((ROOT/'artifacts/card-layouts').glob('*.svg'))
assert len(files)==20, len(files)
rows=[]
with sync_playwright() as p:
 browser=p.chromium.launch();page=browser.new_page()
 for file in files:
  page.set_content(file.read_text())
  bounds=page.locator('body > svg').evaluate('(svg)=>{const r=svg.getBBox();return {x:r.x,y:r.y,width:r.width,height:r.height}}')
  passed=bounds['x']>=-1 and bounds['y']>=-1 and bounds['x']+bounds['width']<=1081 and bounds['y']+bounds['height']<=1351
  rows.append({'variant':file.stem,'bounds':bounds,'passed':passed})
 browser.close()
report={'cases':rows,'passed':sum(row['passed']for row in rows),'failed':sum(not row['passed']for row in rows)}
(ROOT/'artifacts/card-bounds-qa.json').write_text(json.dumps(report,indent=2))
print(json.dumps(report,indent=2))
assert report['failed']==0
