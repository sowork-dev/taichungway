"""Fetch pinned OFL font and create static local derivative for offline cards."""
from pathlib import Path
from urllib.request import urlopen
from hashlib import sha256
from fontTools.ttLib import TTFont
from fontTools.varLib.instancer import instantiateVariableFont
from fontTools import subset
import json
ROOT=Path(__file__).resolve().parents[1]
REV='3be1884c48c3e45b52ecc725676a08f87776373e'
BASE=f'https://raw.githubusercontent.com/google/fonts/{REV}/ofl/notosanstc/'
DEST=ROOT/'assets/fonts'; DEST.mkdir(parents=True, exist_ok=True)
raw=urlopen(BASE+'NotoSansTC%5Bwght%5D.ttf',timeout=60).read()
original=DEST/'upstream.ttf';original.write_bytes(raw)
license_text=urlopen(BASE+'OFL.txt',timeout=30).read().decode()
(DEST/'OFL.txt').write_text(license_text)
font=instantiateVariableFont(TTFont(original),{'wght':400},inplace=False)
options=subset.Options();options.recalc_timestamp=False
subsetter=subset.Subsetter(options=options)
subsetter.populate(unicodes=list(range(0x20,0x100))+list(range(0x2000,0x2070))+list(range(0x3000,0x3100))+list(range(0x3400,0xA000))+list(range(0xFF00,0xFFF0)))
subsetter.subset(font)
for entry in font['name'].names:
 if entry.nameID in [1,2,3,4,6]:
  label={1:'LocalSansTC',2:'Regular',3:'LocalSansTC-Regular-1',4:'LocalSansTC Regular',6:'LocalSansTC-Regular'}[entry.nameID]
  entry.string=label.encode(entry.getEncoding(),errors='replace')
font.save(DEST/'LocalSansTC-Regular.ttf')
original.unlink()
meta={'source':BASE+'NotoSansTC%5Bwght%5D.ttf','revision':REV,'sourceSha256':sha256(raw).hexdigest(),'outputSha256':sha256((DEST/'LocalSansTC-Regular.ttf').read_bytes()).hexdigest(),'license':'OFL-1.1','modifications':'static 400 instance; subset Latin/CJK punctuation/fullwidth/CJK BMP; renamed LocalSansTC','bytes':(DEST/'LocalSansTC-Regular.ttf').stat().st_size}
(DEST/'SOURCE.json').write_text(json.dumps(meta,indent=2)+'\n')
print(json.dumps(meta,indent=2))
