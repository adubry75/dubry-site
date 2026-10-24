"""Tile screenshots into contact sheets: python3 tools/sheet.py <prefix> [per_row] [width]"""
import sys, glob, os
from PIL import Image, ImageDraw
prefix = sys.argv[1]; per = int(sys.argv[2]) if len(sys.argv) > 2 else 4; w = int(sys.argv[3]) if len(sys.argv) > 3 else 390
files = sorted(f for f in glob.glob(f"shots/{prefix}-*.png") if "sheet" not in f)
for k in range(0, len(files), per * 2):
    chunk = files[k:k + per * 2]
    ims = [Image.open(f).convert("RGB") for f in chunk]
    ims = [im.resize((w, int(im.height * w / im.width))) for im in ims]
    h = max(im.height for im in ims)
    rows = (len(ims) + per - 1) // per
    sheet = Image.new("RGB", (per * (w + 8), rows * (h + 24)), (40, 40, 40))
    d = ImageDraw.Draw(sheet)
    for i, (im, f) in enumerate(zip(ims, chunk)):
        x, y = (i % per) * (w + 8), (i // per) * (h + 24)
        sheet.paste(im, (x, y + 20)); d.text((x + 4, y + 4), os.path.basename(f), fill=(255, 255, 255))
    out = f"shots/sheet-{prefix}-{k // (per * 2)}.png"; sheet.save(out); print(out)
