"""Generate local preview fixtures that stand in for content that lives on dubry.com.

Writes into fixtures/_gen/ (git-ignored):
  art-portfolio/index.html + 59 abstract placeholder .jpg files (Facebook-style names)
  portfolio/powerbi.html + 6 fake report screenshots
  images/benches/<file> and images/benches/t/<file> for all 54 benches
Run: python3 tools/make_fixtures.py
"""
import math, os, random
from PIL import Image, ImageDraw, ImageFilter, ImageFont

ROOT = os.path.join(os.path.dirname(__file__), "..", "fixtures", "_gen")
rnd = random.Random(54)

def font(size):
    for p in ["/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
              "/usr/share/fonts/dejavu/DejaVuSans-Bold.ttf"]:
        if os.path.exists(p):
            return ImageFont.truetype(p, size)
    return ImageFont.load_default()

def ensure(path):
    os.makedirs(os.path.dirname(path), exist_ok=True)

def grad(w, h, c1, c2, vertical=True):
    img = Image.new("RGB", (w, h), c1)
    d = ImageDraw.Draw(img)
    n = h if vertical else w
    for i in range(n):
        t = i / max(1, n - 1)
        c = tuple(int(c1[k] + (c2[k] - c1[k]) * t) for k in range(3))
        if vertical:
            d.line([(0, i), (w, i)], fill=c)
        else:
            d.line([(i, 0), (i, h)], fill=c)
    return img

PALETTES = [
    [(20, 24, 60), (240, 90, 120), (255, 200, 90), (60, 200, 220)],
    [(250, 240, 225), (30, 60, 110), (220, 70, 50), (240, 180, 60)],
    [(15, 15, 18), (255, 60, 180), (60, 240, 255), (200, 255, 80)],
    [(230, 220, 200), (120, 80, 60), (60, 110, 90), (200, 150, 90)],
    [(40, 20, 50), (255, 130, 60), (255, 220, 120), (140, 60, 160)],
    [(200, 225, 240), (20, 50, 90), (240, 120, 100), (255, 255, 255)],
]

def art_piece(i):
    w, h = rnd.choice([(900, 1200), (1200, 900), (1000, 1000), (800, 1150), (1200, 800)])
    pal = PALETTES[i % len(PALETTES)]
    img = grad(w, h, pal[0], tuple(min(255, c + 40) for c in pal[0]))
    d = ImageDraw.Draw(img, "RGBA")
    style = i % 4
    for _ in range(rnd.randint(6, 16)):
        c = rnd.choice(pal[1:]) + (rnd.randint(120, 230),)
        x, y = rnd.randint(-100, w), rnd.randint(-100, h)
        s = rnd.randint(60, 420)
        if style == 0:
            d.ellipse([x, y, x + s, y + s], fill=c)
        elif style == 1:
            d.rectangle([x, y, x + s, y + s * rnd.random()], fill=c)
        elif style == 2:
            d.polygon([(x, y), (x + s, y + s // 3), (x + s // 2, y + s)], fill=c)
        else:
            d.arc([x, y, x + s, y + s], 0, 300, fill=c, width=rnd.randint(8, 40))
    # a little cat silhouette in some pieces
    if i % 3 == 0:
        cx, cy, r = w * 0.6, h * 0.62, min(w, h) * 0.16
        col = pal[1] + (230,)
        d.ellipse([cx - r, cy - r, cx + r, cy + r], fill=col)
        d.polygon([(cx - r, cy - r * .3), (cx - r * .8, cy - r * 1.5), (cx - r * .2, cy - r * .9)], fill=col)
        d.polygon([(cx + r, cy - r * .3), (cx + r * .8, cy - r * 1.5), (cx + r * .2, cy - r * .9)], fill=col)
    img = img.filter(ImageFilter.GaussianBlur(1.2))
    return img

def make_art():
    names = []
    for i in range(59):
        a = rnd.randint(100000000, 999999999)
        b = rnd.randint(10**16, 10**17 - 1)
        c = rnd.randint(10**18, 10**19 - 1)
        names.append(f"{a}_{b}_{c}_n.jpg")
    for i, n in enumerate(names):
        p = os.path.join(ROOT, "art-portfolio", n)
        ensure(p)
        art_piece(i).save(p, quality=78)
    imgs = "\n".join(f'    <div class="pic"><img src="./{n}" alt=""></div>' for n in names)
    html = f"""<!doctype html>
<html><head><meta charset="utf-8"><title>Art Portfolio</title>
<link rel="stylesheet" href="./style.css"></head>
<body><h1>Art Portfolio</h1>
<img src="/images/logo-small.png" alt="" width="1" height="1" style="display:none">
<div class="grid">
{imgs}
</div></body></html>"""
    with open(os.path.join(ROOT, "art-portfolio", "index.html"), "w") as f:
        f.write(html)

def make_powerbi():
    titles = ["Sales Overview", "Inventory Health", "Regional Map", "Customer Funnel", "Ops KPIs", "Forecast"]
    for i, t in enumerate(titles):
        w, h = 1600, 900
        img = Image.new("RGB", (w, h), (243, 242, 241))
        d = ImageDraw.Draw(img)
        d.rectangle([0, 0, w, 70], fill=(37, 37, 38))
        d.text((30, 18), t, fill=(255, 255, 255), font=font(30))
        # KPI cards
        for k in range(4):
            x = 30 + k * 390
            d.rectangle([x, 100, x + 360, 230], fill=(255, 255, 255), outline=(220, 220, 220))
            d.text((x + 20, 120), ["Revenue", "Units", "Margin", "Orders"][k], fill=(90, 90, 90), font=font(22))
            d.text((x + 20, 160), f"{rnd.randint(10, 999)}.{rnd.randint(0, 9)}K", fill=(30, 30, 30), font=font(40))
        # bar chart
        d.rectangle([30, 260, 780, 860], fill=(255, 255, 255), outline=(220, 220, 220))
        for b in range(10):
            bh = rnd.randint(80, 480)
            d.rectangle([70 + b * 70, 820 - bh, 110 + b * 70, 820], fill=(18, 139, 171))
        # line chart
        d.rectangle([810, 260, 1570, 860], fill=(255, 255, 255), outline=(220, 220, 220))
        pts = [(850 + j * 70, 760 - 300 * (0.5 + 0.4 * math.sin(j * 0.7 + i))) for j in range(11)]
        d.line(pts, fill=(232, 17, 35), width=5)
        p = os.path.join(ROOT, "portfolio", "images", f"powerbi-{i + 1}.png")
        ensure(p)
        img.save(p)
    imgs = "\n".join(f'<figure><img src="images/powerbi-{i + 1}.png" alt="{t}"><figcaption>{t}</figcaption></figure>' for i, t in enumerate(titles))
    with open(os.path.join(ROOT, "portfolio", "powerbi.html"), "w") as f:
        f.write(f"<!doctype html><html><head><meta charset=utf-8><title>Power BI</title></head><body><h1>Power BI</h1>\n{imgs}\n</body></html>")

BENCHES = """01_Spillway.jpg,02_salamander.jpg,03_RedOsier.jpg,04_Trillium.jpg,05_FrogSong.jpg,06_NorlingBridge.jpg,07_TheNarrows.jpg,08_SiskiyouRidge.jpg,09_SiskiyouView.jpg,10_KnobconePine.jpg,11_Grandview.jpg,12_GraniteFalls.jpg,13_Pipsissewa.jpg,14_CantrellFalls.jpg,15_Ridgeview.jpg,16_DickAmes.jpg,17_CanyonVista.jpg,18_Coyote.jpg,19_GraniteView.jpg,20_Dogwood.jpg,21_blackSnag.jpg,22_acorn.jpg,23_theGrotto.jpg,24_mapleGrove.jpg,25_JacksonRidge.jpg,26_Serendipity.jpg,27_Sunrise.jpg,28_WrenSong.jpg,29_UpperTwinPeak.jpg,30_LowerTwinPeak.jpg,31_CascadeCrestShelter-alt.jpg,32_Madrone.jpg,33_MountainMahogany.jpg,34_manzanita.jpg,35_RedButtesSelfie.jpg,36_Ol'Rocky.jpg,37_UpperFalls.jpg,38_HighLonesome.jpg,39_TranquilityBase.jpg,40_CanyonFalls.jpg,41_VulturesRoost.jpg,42_BlueSky.jpg,43_Mahonia.jpg,44_FernGlen.jpg,45_Arbutus.jpg,46_RapaNui.jpg,47_MadronePoint.jpg,48_Dawn.jpg,49_MockOrangeJoy.jpg,50_Weathertop.jpg,51_Eagle.jpg,52_BearclawFalls.jpg,53_VolkswagenFalls.jpg,54_AZHA.jpg""".split(",")

def bench_img(i, w, h):
    sky = [(150, 190, 230), (250, 190, 140), (120, 160, 210), (200, 210, 230)][i % 4]
    img = grad(w, h, sky, (235, 235, 220))
    d = ImageDraw.Draw(img, "RGBA")
    # hills
    for layer, col in enumerate([(70, 110, 90), (45, 85, 60), (30, 60, 40)]):
        base = h * (0.45 + layer * 0.12)
        pts = [(0, h)]
        for x in range(0, w + 40, 40):
            pts.append((x, base + math.sin(x / (90 + 30 * layer) + i + layer) * h * 0.06))
        pts.append((w, h))
        d.polygon(pts, fill=col)
    # trees
    for _ in range(8):
        x = rnd.randint(0, w)
        y = rnd.randint(int(h * .55), int(h * .8))
        s = rnd.randint(int(h * .08), int(h * .2))
        d.polygon([(x, y - s), (x - s // 3, y), (x + s // 3, y)], fill=(20, 50, 30))
    # bench
    bx, by, bw = w * .3, h * .78, w * .4
    d.rectangle([bx, by, bx + bw, by + h * .03], fill=(110, 70, 40))
    d.rectangle([bx, by - h * .08, bx + bw, by - h * .055], fill=(110, 70, 40))
    for lx in (bx + bw * .08, bx + bw * .88):
        d.rectangle([lx, by, lx + w * .015, by + h * .1], fill=(80, 50, 30))
    d.text((w * .04, h * .04), f"#{i + 1}", fill=(255, 255, 255, 230), font=font(int(h * .12)))
    return img

def make_benches():
    for i, n in enumerate(BENCHES):
        full = os.path.join(ROOT, "images", "benches", n)
        th = os.path.join(ROOT, "images", "benches", "t", n)
        ensure(full); ensure(th)
        big = bench_img(i, 1200, 900)
        big.save(full, quality=72)
        big.resize((240, 180)).save(th, quality=75)

if __name__ == "__main__":
    make_art(); make_powerbi(); make_benches()
    print("fixtures written to", os.path.abspath(ROOT))
