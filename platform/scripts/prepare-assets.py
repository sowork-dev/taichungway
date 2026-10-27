"""Prepare original static OG art and same-origin card font copies."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont
from shutil import copy2
ROOT=Path(__file__).resolve().parents[1]
FONT=ROOT/'assets/fonts/LocalSansTC-Regular.ttf'
assert FONT.exists(), 'Run python3 scripts/prepare-font.py first'
font=lambda size:ImageFont.truetype(str(FONT),size)
for app,title,description in [('hub','日常遊樂場','從市場的早安，到海線的晚風。'),('fortune','沾一點福氣','長按一下，把小小祝福帶回家。'),('flavor','你是哪一味','三個選擇，遇見你的台中日常。')]:
 public=ROOT/'apps'/app/'public'
 (public/'og').mkdir(parents=True,exist_ok=True);(public/'fonts').mkdir(exist_ok=True)
 for file in ['LocalSansTC-Regular.ttf','OFL.txt','SOURCE.json']:copy2(ROOT/'assets/fonts'/file,public/'fonts'/file)
 image=Image.new('RGB',(1200,630),'#F3F8FF');draw=ImageDraw.Draw(image)
 draw.rounded_rectangle((780,55,1140,575),radius=170,fill='#E3EFFF')
 draw.ellipse((1000,100,1090,190),fill='#7FC0F0')
 if app=='fortune':
  draw.rectangle((840,260,1080,470),fill='#1A63C8');draw.polygon([(810,255),(885,200),(1040,200),(1110,255)],fill='#112A4D')
  draw.rounded_rectangle((920,335,1000,510),radius=40,fill='#F3F8FF')
 elif app=='flavor':
  draw.polygon([(800,430),(1120,430),(1070,485),(850,485)],fill='#112A4D');draw.line((945,195,945,440),fill='#112A4D',width=7)
  draw.polygon([(963,210),(963,404),(1090,404)],fill='#1A63C8');draw.arc((790,480,1120,545),0,180,fill='#134E9E',width=9)
 else:
  draw.polygon([(800,405),(900,240),(1020,405)],fill='#1A63C8');draw.polygon([(900,425),(1030,275),(1140,425)],fill='#134E9E')
  draw.rectangle((825,390,1030,475),fill='#1A63C8');draw.polygon([(800,388),(840,340),(1010,340),(1050,388)],fill='#112A4D')
 draw.text((70,66),'台中味  /  獨立預覽',font=font(28),fill='#112A4D')
 draw.line((70,128,710,128),fill='#BDD8FA',width=2)
 draw.text((65,200),title,font=font(80),fill='#112A4D')
 draw.text((70,332),description,font=font(31),fill='#134E9E')
 draw.text((70,492),'非官方網站・未取得競選團隊授權或背書',font=font(23),fill='#134E9E')
 draw.text((70,540),'手機打開，就能開始玩。',font=font(25),fill='#112A4D')
 image.save(public/'og'/f'{app}.png',optimize=True)
 print(app,'OG1200x630', (public/'og'/f'{app}.png').stat().st_size)
for app in ['fortune','flavor']:
 copy2(ROOT/'apps'/app/'public/og'/f'{app}.png',ROOT/'apps/hub/public/og'/f'{app}.png')
