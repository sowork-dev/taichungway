"""Produce original 1200x630 sharing covers for the three city studios."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT=Path(__file__).resolve().parents[1]
FONT=ROOT/'assets/fonts/LocalSansTC-Regular.ttf'
for key,title,description in [
    ('comic','巷口四格漫畫','把一件小事，畫成四格城市故事。'),
    ('check','對開支票本','一邊寫願望，一邊對照城市提案。'),
    ('postcard','台中聲音明信片','混一段聲景，寄給想念的人。'),
]:
    image=Image.new('RGB',(1200,630),'#FFFFFF')
    draw=ImageDraw.Draw(image)
    def font(n): return ImageFont.truetype(str(FONT),n)
    draw.rectangle((56,56,101,101),outline='#1A63C8',width=2)
    draw.text((64,59),'味',font=font(28),fill='#1A63C8')
    draw.text((120,65),'台中味  /  TAICHUNG WAY',font=font(24),fill='#1A63C8')
    draw.line((56,139,1144,139),fill='#DCE5F2',width=2)
    draw.text((56,210),title,font=font(74),fill='#112A4D')
    draw.text((60,340),description,font=font(32),fill='#526780')
    draw.line((56,470,1144,470),fill='#DCE5F2',width=2)
    draw.text((60,505),'江啟臣政見互動 · 非官方製作 · 非施政成果',font=font(24),fill='#1A63C8')
    draw.text((60,550),'未取得競選團隊授權或背書',font=font(21),fill='#526780')
    target=ROOT/'apps/hub/public/og'/f'{key}.png'
    target.parent.mkdir(parents=True,exist_ok=True)
    image.save(target,optimize=True)
    print(key,image.size,target.stat().st_size)
