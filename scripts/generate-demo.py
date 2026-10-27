"""Reproduce the original geometric Amber Keep demo art. Requires Pillow (development only)."""
from pathlib import Path
from PIL import Image, ImageDraw, ImageFilter
import random

ROOT = Path(__file__).resolve().parent.parent / "content/examples/amber-keep"
ROOT.mkdir(parents=True, exist_ok=True)
rng = random.Random(2048)
W, H = 1440, 960
image = Image.new("RGB", (W, H), "#34413b")
draw = ImageDraw.Draw(image)
for _ in range(52000):
    x, y = rng.randrange(W), rng.randrange(H)
    c = rng.choice(["#3d4a3e", "#354038", "#435044", "#3e483b", "#303c35"])
    draw.line((x, y, x+rng.randrange(2, 10), y+rng.randrange(-3, 4)), fill=c, width=1)
# Paths and the quiet river along the eastern woodland.
draw.line([(900,-80),(1080,160),(1110,380),(1280,570),(1260,1000)], fill="#253437", width=100)
draw.line([(900,-80),(1080,160),(1110,380),(1280,570),(1260,1000)], fill="#536969", width=72)
draw.line([(900,-80),(1080,160),(1110,380),(1280,570),(1260,1000)], fill="#637875", width=48)
draw.line([(640,1040),(640,780),(590,640),(590,420)], fill="#65604a", width=155)
draw.line([(640,1040),(640,780),(590,640),(590,420)], fill="#8b8060", width=118)
for _ in range(700):
    x,y=rng.randrange(585,700),rng.randrange(650,H)
    draw.ellipse((x,y,x+3,y+2), fill="#afa080")
# Stone courtyard and keep; geometry stays aligned to the 60px world grid.
draw.rectangle((320,140,1030,730), fill="#272f2d")
draw.rectangle((330,150,1020,720), fill="#a49a7f")
for y in range(150,720,30):
    for x in range(330,1020,45):
        draw.rectangle((x+1,y+1,x+43,y+28), fill=rng.choice(["#9b9279","#a0987e","#aaa086","#938b76"]))
# Interior rooms.
draw.rectangle((400,210,950,560), fill="#736b58")
for x in range(405,950,24): draw.line((x,215,x,555),fill="#80755e",width=1)
walls=[(390,200,960,225),(390,200,415,570),(390,545,560,570),(650,545,960,570),(935,200,960,570),
       (690,215,710,430),(700,405,805,425),(865,405,945,425)]
for box in walls:
    draw.rectangle(box, fill="#3a3b34")
    x1,y1,x2,y2=box
    draw.rectangle((x1+4,y1+4,x2-4,y2-4),fill="#bbb194")
    if x2-x1>y2-y1:
        for x in range(x1+18,x2,30): draw.line((x,y1,x,y2), fill="#747161",width=2)
    else:
        for y in range(y1+18,y2,30): draw.line((x1,y,x2,y), fill="#747161",width=2)
# Main doors, long table, bedrolls and crates.
draw.rectangle((560,543,650,569),fill="#453d30")
draw.rectangle((570,547,640,560),fill="#9a7952")
draw.rounded_rectangle((455,295,600,365),radius=6,fill="#302e25")
draw.rectangle((460,290,595,355),fill="#8b6744",outline="#c29762",width=2)
for y in [270,370]:
    for x in [470,520,570]: draw.rectangle((x,y,x+24,y+20),fill="#795b3d",outline="#ae895c",width=2)
for x,y in [(745,250),(870,250),(870,465)]:
    draw.rectangle((x,y,x+42,y+55),fill="#463e31",outline="#a88c5a",width=3)
    draw.line((x,y,x+42,y+55),fill="#a88c5a",width=2)
    draw.line((x+42,y,x,y+55),fill="#a88c5a",width=2)
# Watchtower drum, paving and small firepit.
draw.ellipse((330,130,460,260),fill="#353b33",outline="#c3b99b",width=15)
draw.ellipse((352,152,438,238),fill="#8e846b",outline="#615c4c",width=2)
draw.ellipse((800,595,885,680),fill="#504b3d",outline="#c1b38b",width=8)
draw.ellipse((826,620,860,654),fill="#ae733c")
draw.ellipse((838,628,850,646),fill="#e8bf73")
# Woodland canopy with deterministic irregular silhouettes.
for _ in range(105):
    x,y=rng.randrange(-40,W+40),rng.randrange(-40,H+40)
    if 240<x<1080 and 80<y<790: continue
    if 530<x<760 and y>680: continue
    if abs(x-(1000+y*.27))<90: continue
    radius=rng.randrange(28,65)
    draw.ellipse((x-radius+8,y-radius+12,x+radius+8,y+radius+12),fill="#26352e")
    for _ in range(7):
        ox,oy=rng.randrange(-radius//2,radius//2),rng.randrange(-radius//2,radius//2)
        r=rng.randrange(radius//2,radius)
        draw.ellipse((x+ox-r,y+oy-r,x+ox+r,y+oy+r),fill=rng.choice(["#46583f","#506145","#3d503b","#58664a"]))
# Texture, small rounded border and local export.
image.save(ROOT / "map.png", optimize=True)
for filename,base,cloak in [("warden.png","#273b49","#d5ad62"),("scout.png","#263f38","#90c1a7"),("sentinel.png","#3e2e40","#b394b5")]:
    token=Image.new("RGBA",(160,160),(0,0,0,0)); d=ImageDraw.Draw(token)
    d.ellipse((4,4,156,156),fill=base,outline=cloak,width=6)
    d.polygon([(80,54),(35,134),(125,134)],fill=cloak)
    d.ellipse((57,34,103,86),fill="#c5ac8a")
    d.polygon([(51,55),(64,28),(94,28),(110,58),(100,44),(61,44)],fill="#302d2a")
    d.rectangle((71,86,88,132),fill=base)
    d.ellipse((76,97,84,105),fill="#edce89")
    token.save(ROOT/filename,optimize=True)
