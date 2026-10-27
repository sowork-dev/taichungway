"""Integrated real-browser acceptance for the three city studios.

Run after pnpm build + PORT=4193 pnpm serve. TEST_ORIGIN may point at HTTPS.
Evidence is incremental JSONL so an interrupted run cannot masquerade as success.
No real personal information is used.
"""
import asyncio
import json
import os
import time
from pathlib import Path
from urllib.parse import urlparse, parse_qs
from playwright.async_api import async_playwright

ROOT=Path(__file__).resolve().parents[1]
OUT=ROOT/'artifacts'/'three-studios'/os.getenv('QA_LABEL','local')
ORIGIN=os.getenv('TEST_ORIGIN','http://127.0.0.1:4193').rstrip('/')
OUT.mkdir(parents=True,exist_ok=True)
RESULTS=[]

def record(name,details=None):
    row={'test':name,'passed':True,'details':details}
    RESULTS.append(row)
    with (OUT/'checks.jsonl').open('a') as f:f.write(json.dumps(row,ensure_ascii=False)+'\n')
    print('PASS',name,flush=True)

async def no_overflow(page,label):
    dimensions=await page.evaluate('() => ({inner:innerWidth,scroll:document.documentElement.scrollWidth})')
    assert dimensions['scroll']<=dimensions['inner'],(label,dimensions)

async def download(page,key):
    async with page.expect_download(timeout=45000) as event:
        await page.get_by_test_id('studio-download').click()
    item=await event.value
    path=OUT/f'{key}-download.png'
    await item.save_as(path)
    from PIL import Image
    with Image.open(path) as image:
        assert image.size==(1080,1350),(key,image.size)
        assert image.convert('RGB').getextrema()!=((255,255),)*3
    await page.get_by_role('status').filter(has_text='圖卡已準備好').wait_for(timeout=20000)
    record(key+' actual PNG download',{'size':[1080,1350],'bytes':path.stat().st_size})

async def main():
    (OUT/'checks.jsonl').write_text('')
    (OUT/'summary.json').write_text(json.dumps({'status':'running','origin':ORIGIN}))
    errors=[];requests=[]
    async with async_playwright() as p:
        browser=await p.chromium.launch()
        context=await browser.new_context(viewport={'width':1280,'height':1000},accept_downloads=True,permissions=['clipboard-read','clipboard-write'])
        await context.add_init_script("""(() => {
          window.__audioStarts=[];
          const original=AudioBufferSourceNode.prototype.start;
          AudioBufferSourceNode.prototype.start=function(...args){
            const b=this.buffer;
            if(b && b.length>1000){const samples=b.getChannelData(0);let sum=0;for(let i=0;i<samples.length;i+=50)sum+=samples[i]*samples[i];window.__audioStarts.push({length:b.length,duration:b.duration,energy:sum,context:this.context.state});}
            return original.apply(this,args);
          };
          window.__shareCalls=[];
          Object.defineProperty(navigator,'share',{configurable:true,value:async data=>window.__shareCalls.push(data)});
        })();""")
        page=await context.new_page()
        page.on('pageerror',lambda error:errors.append(str(error)))
        page.on('request',lambda request:requests.append({'method':request.method,'url':request.url}))
        for route in ['/','/comic/','/check/','/postcard/']:
            await page.goto(ORIGIN+route,wait_until='networkidle')
            await no_overflow(page,route)
            await page.screenshot(path=str(OUT/f"{route.strip('/') or 'hub'}-desktop.png"),full_page=True)
        record('desktop initial routes render without overflow')

        await page.goto(ORIGIN+'/comic/',wait_until='networkidle')
        await page.locator('#comic-event').fill('買菜時發現購物袋還留在家裡。')
        await page.locator('#comic-nickname').fill('試玩者')
        await page.get_by_test_id('comic-create').click()
        assert await page.locator('.comic-panel').count()==4
        await page.get_by_test_id('comic-caption-1').fill('改成我自己的旁白')
        assert await page.locator('.comic-artwork').inner_text() and '改成我自己的旁白' in await page.locator('.comic-artwork').inner_text()
        await page.get_by_test_id('comic-style-print').click()
        assert '改成我自己的旁白' not in await page.locator('.comic-artwork').inner_text()
        for scene in ['market','corner','park','station','mountain','coast']:
            control=page.get_by_test_id('comic-scene-'+scene)
            assert await control.count()==1,scene
            await control.click()
            assert await page.locator('.comic-panel').count()==4
            assert await page.locator('.comic-artwork [data-policy-id]').count()==1
        record('comic generation, four panels, editing and style/scene regeneration')
        await page.screenshot(path=str(OUT/'comic-result-desktop.png'),full_page=True)
        await download(page,'comic')
        await page.get_by_test_id('studio-share').click()
        shared=await page.evaluate('window.__shareCalls.at(-1).url')
        assert not urlparse(shared).query
        await page.get_by_test_id('comic-replay').click()
        assert await page.locator('#comic-event').input_value()==''
        assert await page.get_by_test_id('studio-download').count()==0
        record('comic safe URL and complete replay')

        await page.goto(ORIGIN+'/check/',wait_until='networkidle')
        await page.locator('[data-check-example]').first.click()
        await page.locator('#check-nickname').fill('試玩者')
        await page.get_by_role('button',name='簽下我的四年').click()
        assert await page.get_by_test_id('studio-download').count()==0
        await page.get_by_role('button',name='把兩張對開').click()
        assert '公有市場裝冷氣，打造特色市場' in await page.locator('.check-artwork').inner_text()
        await download(page,'check')
        await page.screenshot(path=str(OUT/'check-result-desktop.png'),full_page=True)
        await page.get_by_role('button',name='開啟翻頁預覽').click()
        await page.get_by_role('button',name='下一頁').wait_for()
        await page.get_by_role('button',name='下一頁').click()
        await page.wait_for_timeout(850)
        assert await page.locator('.check-book-page').count()==4
        await page.get_by_role('button',name='再開一張').click()
        assert await page.locator('#check-wish').input_value()==''
        assert await page.get_by_test_id('studio-download').count()==0
        record('check example, reveal/export gate, real PageFlip and clean reset')
        await page.locator('#check-wish').fill('我想讓月亮變成起司。')
        await page.get_by_role('button',name='簽下我的四年').click()
        await page.get_by_role('button',name='把兩張對開').click()
        assert '本機尚未找到對應' in await page.locator('.check-artwork').inner_text()
        record('check unmatched wish does not invent an official match')

        await page.goto(ORIGIN+'/postcard/',wait_until='networkidle')
        assert await page.locator('[data-postcard-district]').count()==29
        assert not await page.evaluate('window.__audioStarts.length')
        # Every district selector is exercised; this is not a geographic/acoustic authenticity test.
        for button in await page.locator('[data-postcard-district]').all():
            await button.click();assert await button.get_attribute('aria-pressed')=='true'
            await button.click();assert await button.get_attribute('aria-pressed')=='false'
        for id in ['d01','d12','d28']: await page.locator(f'[data-postcard-district="{id}"]').click()
        assert await page.locator('[data-postcard-district="d02"]').get_attribute('aria-disabled')=='true'
        await page.locator('[data-postcard-district="d02"]').click(force=True)
        assert await page.locator('[data-postcard-district][aria-pressed="true"]').count()==3
        await page.locator('#gain-d01').fill('35')
        await page.locator('#postcard-note').fill('今天，想把晚風寄給你。')
        await page.locator('#postcard-nickname').fill('試玩者')
        await page.get_by_role('button',name='▶ 播放／重試').click()
        await page.wait_for_function('() => document.querySelectorAll("[data-audio-state=playing]").length === 3',timeout=20000)
        starts=await page.evaluate('window.__audioStarts')
        assert len(starts)>=3 and all(x['energy']>0 and x['context']=='running' and x['duration']==10 for x in starts),starts
        record('all 29 district controls, max3 and actual decoded running WebAudio loops',starts)
        await page.screenshot(path=str(OUT/'postcard-result-desktop.png'),full_page=True)
        # Download while actively playing confirms export does not break the mixer.
        await download(page,'postcard')
        await page.get_by_test_id('studio-share').click()
        share=await page.evaluate('window.__shareCalls.at(-1).url')
        params=parse_qs(urlparse(share).query)
        assert set(params)=={'mix'} and params['mix']==['d01:35,d12:60,d28:60'],params
        assert '試玩者' not in share
        await page.get_by_role('button',name='■ 停止全部').click()
        await page.wait_for_function('() => document.querySelectorAll("[data-audio-state=playing]").length === 0')
        await page.goto(share,wait_until='networkidle')
        assert not await page.evaluate('window.__audioStarts.length'),'receiver must not autoplay'
        assert await page.locator('#gain-d01').input_value()=='35'
        await page.get_by_role('button',name='▶ 播放／重試').click()
        await page.wait_for_function('() => document.querySelectorAll("[data-audio-state=playing]").length === 3',timeout=20000)
        record('postcard exact public recipe sharing and gesture-only receiver replay')
        await page.goto(ORIGIN+'/postcard/m/?mix=d01:999',wait_until='networkidle')
        assert '這份聆聽連結無效' in await page.inner_text('body')
        assert not await page.locator('.postcard-track').count()
        record('malformed postcard recipe fails closed')

        for width in [360,390,768]:
            await page.set_viewport_size({'width':width,'height':844})
            for route in ['/','/comic/','/check/','/postcard/']:
                await page.goto(ORIGIN+route,wait_until='networkidle')
                await no_overflow(page,f'{route} {width}')
                if width==390:await page.screenshot(path=str(OUT/f"{route.strip('/') or 'hub'}-mobile.png"),full_page=True)
        record('360/390/768 responsive routes without horizontal overflow')
        assert not errors,errors
        sensitive=[r for r in requests if r['method']!='GET' or (urlparse(r['url']).scheme in ('http','https') and not r['url'].startswith(ORIGIN+'/'))]
        assert not sensitive,sensitive
        record('no runtime page errors or off-origin/private-text network requests',{'requestCount':len(requests)})
        await context.close();await browser.close()
        # Mobile WebKit smoke is distinct from physical iOS/LINE acceptance.
        webkit=await p.webkit.launch();ctx=await webkit.new_context(viewport={'width':390,'height':844},reduced_motion='reduce');tab=await ctx.new_page()
        for route in ['/comic/','/check/','/postcard/']:
            await tab.goto(ORIGIN+route,wait_until='networkidle');await no_overflow(tab,'webkit '+route)
            assert await tab.locator('.studio-shell').count()==1
        record('WebKit reduced-motion mobile render smoke')
        await webkit.close()
    summary={'status':'passed','origin':ORIGIN,'passed':len(RESULTS),'checks':RESULTS,'scope':'browser automation, not physical LINE or human design acceptance'}
    (OUT/'summary.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2))
    print(json.dumps({'status':'passed','checks':len(RESULTS),'evidence':str(OUT)},ensure_ascii=False))

if __name__=='__main__':
    try:asyncio.run(main())
    except Exception as error:
        (OUT/'summary.json').write_text(json.dumps({'status':'failed','origin':ORIGIN,'passed':len(RESULTS),'error':str(error),'checks':RESULTS},ensure_ascii=False,indent=2))
        raise
