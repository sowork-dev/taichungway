"""Regression: after >65s idle, an actual browser reload still loads all scripts/data."""
import json
import sys
import time
from pathlib import Path
from playwright.sync_api import sync_playwright
base=(sys.argv[1] if len(sys.argv)>1 else 'https://taichungway.sowork.ai').rstrip('/')
report_path=Path(__file__).resolve().parents[1]/'qa'/'reload-results.json'
report={'status':'incomplete','base':base,'idleSeconds':70}
report_path.write_text(json.dumps(report,indent=2))
with sync_playwright() as p:
    browser=p.chromium.launch(headless=True)
    page=browser.new_page(viewport={'width':390,'height':844})
    page.goto(base,wait_until='domcontentloaded')
    page.wait_for_selector('#homeTopics .topic-tile', state='attached', timeout=15000)
    time.sleep(70)
    start=time.monotonic()
    page.reload(wait_until='domcontentloaded',timeout=20000)
    page.wait_for_selector('#homeTopics .topic-tile', state='attached', timeout=15000)
    assert page.evaluate('records.length')==12
    report.update(status='passed',reloadSeconds=round(time.monotonic()-start,3),records=12)
    report_path.write_text(json.dumps(report,indent=2))
    print(json.dumps(report))
    browser.close()
