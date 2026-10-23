"""Generate original, clearly-labelled placeholder illustrations (SVG).

These stand in for real product photography until the business supplies
licensed images. Run: python3 scripts/generate-placeholders.py
"""
import math
import random
from pathlib import Path

OUT = Path(__file__).resolve().parent.parent / "public" / "placeholders"
OUT.mkdir(parents=True, exist_ok=True)

# name: (background, item fill, item stroke, shape, label)
ITEMS = {
    "almonds": ("#F6EEE1", "#B9774A", "#7A4A2A", "almond", "Almonds"),
    "cashews": ("#F7F0E4", "#EBD3A8", "#B8955C", "cashew", "Cashews"),
    "walnuts": ("#F3EADC", "#C49A6C", "#7E5A36", "walnut", "Walnuts"),
    "pistachios": ("#F2EFE2", "#C9B98E", "#7F8C4E", "pistachio", "Pistachios"),
    "raisins": ("#F7E9CF", "#C9862B", "#8A5313", "raisin", "Raisins"),
    "dates": ("#F1E2D6", "#6B3A22", "#3F2013", "date", "Dates"),
    "seeds": ("#F2EFE2", "#5E7044", "#3B4A2A", "seed", "Seeds"),
    "trail-mix": ("#F4E8D6", "#B9774A", "#7A4A2A", "mix", "Trail Mix"),
    "gift-hampers": ("#F1E4D0", "#C89136", "#38251D", "box", "Gift Hampers"),
    "apricots": ("#FBE7CF", "#E58A2E", "#A85A14", "round", "Apricots"),
    "figs": ("#F2E4D2", "#B48A5E", "#6E4C2C", "fig", "Dried Figs"),
    "cranberries": ("#F6DEDC", "#A3232E", "#661018", "raisin", "Cranberries"),
    "blueberries": ("#E7E4F0", "#2E2A5A", "#16133A", "round", "Blueberries"),
    "corn-nuts": ("#FBEBCB", "#E2A93B", "#A8701B", "round", "Corn Nuts"),
    "makhana": ("#F6F1E6", "#F3EAD3", "#C9B58C", "puff", "Makhana"),
    "saffron": ("#F7EEE4", "#B3261E", "#7A140F", "thread", "Saffron"),
    "cardamom": ("#F1F0E2", "#9CB46A", "#5D7536", "seed", "Cardamom"),
    "spice": ("#F8ECE2", "#B5401F", "#7C2A12", "powder", "Spices"),
    "bhujia": ("#FAF0DC", "#D99A2B", "#A0661A", "thread", "Bhujia"),
    "tea": ("#EEF0E4", "#3F5A2C", "#24361A", "seed", "Tea"),
    "jaggery": ("#F6EBDA", "#A8662A", "#6E3E14", "cube", "Jaggery"),
}

# Jar products: (background, contents colour, label)
JARS = {
    "honey": ("#F8EEDC", "#D99A2B", "Honey"),
    "pickle": ("#F7EBDD", "#C4561F", "Pickle"),
    "chutney": ("#F5EADF", "#8E2A1E", "Chutney"),
}

MIX_COLORS = [("#B9774A", "#7A4A2A"), ("#EBD3A8", "#B8955C"), ("#C9862B", "#8A5313"), ("#A3232E", "#661018"), ("#C9B98E", "#7F8C4E")]


def shape(kind, x, y, r, rot, fill, stroke):
    t = f'transform="rotate({rot:.0f} {x:.0f} {y:.0f})"'
    if kind == "almond":
        return f'<path {t} d="M{x-r*1.3:.0f},{y:.0f} Q{x:.0f},{y-r*1.1:.0f} {x+r*1.3:.0f},{y:.0f} Q{x:.0f},{y+r*0.9:.0f} {x-r*1.3:.0f},{y:.0f}Z" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
    if kind == "cashew":
        return f'<path {t} d="M{x-r:.0f},{y-r*0.4:.0f} A{r*1.1:.0f},{r*1.1:.0f} 0 1 0 {x+r:.0f},{y-r*0.4:.0f} L{x+r*0.45:.0f},{y-r*0.4:.0f} A{r*0.55:.0f},{r*0.55:.0f} 0 1 1 {x-r*0.45:.0f},{y-r*0.4:.0f}Z" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
    if kind == "walnut":
        return (f'<g {t}><ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{r*1.2:.0f}" ry="{r:.0f}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
                f'<path d="M{x:.0f},{y-r:.0f} C{x-r*0.4:.0f},{y-r*0.3:.0f} {x+r*0.4:.0f},{y+r*0.3:.0f} {x:.0f},{y+r:.0f}" stroke="{stroke}" stroke-width="3" fill="none"/>'
                f'<path d="M{x-r*0.8:.0f},{y-r*0.2:.0f} q{r*0.3:.0f},{r*0.4:.0f} {r*0.6:.0f},0 M{x+r*0.2:.0f},{y+r*0.2:.0f} q{r*0.3:.0f},{r*0.4:.0f} {r*0.6:.0f},0" stroke="{stroke}" stroke-width="2.5" fill="none"/></g>')
    if kind == "pistachio":
        return (f'<g {t}><ellipse cx="{x:.0f}" cy="{y:.0f}" rx="{r*1.25:.0f}" ry="{r*0.85:.0f}" fill="{fill}" stroke="#8E7B55" stroke-width="3"/>'
                f'<ellipse cx="{x+r*0.15:.0f}" cy="{y:.0f}" rx="{r*0.6:.0f}" ry="{r*0.38:.0f}" fill="#8BA35A" stroke="{stroke}" stroke-width="2"/></g>')
    if kind == "raisin":
        return f'<path {t} d="M{x-r:.0f},{y:.0f} q{r*0.2:.0f},{-r:.0f} {r:.0f},{-r*0.8:.0f} q{r:.0f},{r*0.1:.0f} {r*0.9:.0f},{r*0.9:.0f} q{-r*0.3:.0f},{r*0.8:.0f} {-r:.0f},{r*0.7:.0f} q{-r*0.8:.0f},{-r*0.1:.0f} {-r*0.9:.0f},{-r*0.8:.0f}Z" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
    if kind == "date":
        return f'<ellipse {t} cx="{x:.0f}" cy="{y:.0f}" rx="{r*1.5:.0f}" ry="{r*0.75:.0f}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
    if kind == "seed":
        return f'<ellipse {t} cx="{x:.0f}" cy="{y:.0f}" rx="{r*0.9:.0f}" ry="{r*0.45:.0f}" fill="{fill}" stroke="{stroke}" stroke-width="2.5"/>'
    if kind == "fig":
        return (f'<g {t}><circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
                f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r*0.45:.0f}" fill="#D9B98C" stroke="{stroke}" stroke-width="2"/></g>')
    if kind == "box":
        return (f'<g {t}><rect x="{x-r:.0f}" y="{y-r*0.8:.0f}" width="{r*2:.0f}" height="{r*1.6:.0f}" rx="8" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
                f'<rect x="{x-r*0.12:.0f}" y="{y-r*0.8:.0f}" width="{r*0.24:.0f}" height="{r*1.6:.0f}" fill="#0D5A44"/>'
                f'<rect x="{x-r:.0f}" y="{y-r*0.12:.0f}" width="{r*2:.0f}" height="{r*0.24:.0f}" fill="#0D5A44"/></g>')
    if kind == "puff":
        return (f'<g {t}><circle cx="{x:.0f}" cy="{y:.0f}" r="{r*0.95:.0f}" fill="{fill}" stroke="{stroke}" stroke-width="2.5"/>'
                f'<path d="M{x-r*0.5:.0f},{y-r*0.2:.0f} q{r*0.3:.0f},{-r*0.4:.0f} {r*0.7:.0f},{-r*0.1:.0f}" stroke="{stroke}" stroke-width="2" fill="none"/>'
                f'<circle cx="{x+r*0.3:.0f}" cy="{y+r*0.3:.0f}" r="{r*0.18:.0f}" fill="#8A6A3A" opacity="0.5"/></g>')
    if kind == "thread":
        return f'<path {t} d="M{x-r*1.3:.0f},{y:.0f} q{r*0.6:.0f},{-r*0.5:.0f} {r*1.3:.0f},0 t{r*1.3:.0f},0" stroke="{fill}" stroke-width="{max(3, r*0.18):.0f}" stroke-linecap="round" fill="none"/>'
    if kind == "powder":
        return f'<ellipse {t} cx="{x:.0f}" cy="{y:.0f}" rx="{r*0.9:.0f}" ry="{r*0.7:.0f}" fill="{fill}" stroke="{stroke}" stroke-width="1.5" opacity="0.95"/>'
    if kind == "cube":
        return (f'<g {t}><rect x="{x-r*0.8:.0f}" y="{y-r*0.8:.0f}" width="{r*1.6:.0f}" height="{r*1.6:.0f}" rx="6" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'
                f'<path d="M{x-r*0.5:.0f},{y-r*0.4:.0f} l{r*0.5:.0f},{r*0.2:.0f}" stroke="#D9A866" stroke-width="3" opacity="0.6"/></g>')
    return f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'


def jar_svg(bg, contents, label):
    w = h = 800
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{label} placeholder illustration">
{BRASS_DEFS}
<defs><linearGradient id="glass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.55"/><stop offset="0.2" stop-color="#FFFFFF" stop-opacity="0.1"/><stop offset="0.8" stop-color="#FFFFFF" stop-opacity="0.05"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.45"/></linearGradient></defs>
<rect width="{w}" height="{h}" fill="{bg}"/>
<g fill="none" stroke="#B8893B" stroke-opacity="0.12">{''.join(f'<circle cx="400" cy="380" r="{r}"/>' for r in (150, 210, 270, 330))}</g>
<rect width="{w}" height="{h}" fill="url(#glow)"/>
<ellipse cx="400" cy="640" rx="190" ry="22" fill="#000" opacity="0.15"/>
<rect x="245" y="300" width="310" height="340" rx="46" fill="{contents}"/>
<rect x="245" y="300" width="310" height="340" rx="46" fill="url(#glass)" stroke="#B8893B" stroke-opacity="0.35" stroke-width="3"/>
<rect x="268" y="230" width="264" height="82" rx="14" fill="url(#brass)"/>
<rect x="268" y="296" width="264" height="10" fill="url(#rim)"/>
<rect x="300" y="400" width="200" height="130" rx="10" fill="#FAF6EF" stroke="#B8893B" stroke-width="3"/>
<text x="400" y="458" text-anchor="middle" font-family="Georgia, serif" font-size="30" fill="#0D5A44">{label}</text>
<text x="400" y="494" text-anchor="middle" font-family="Georgia, serif" font-size="15" letter-spacing="4" fill="#96701F">BHARAT SECRETS</text>
<text x="400" y="730" text-anchor="middle" font-family="Georgia, serif" font-size="34" letter-spacing="6" fill="#0A3328">{label.upper()}</text>
<text x="400" y="764" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="5" fill="#96701F">PLACEHOLDER IMAGE</text>
</svg>
'''


def bowl_items(kind, fill, stroke, cx, cy, w, count, size, seed):
    rnd = random.Random(seed)
    parts = []
    pts = []
    for i in range(count):
        u = rnd.uniform(-1, 1)
        height = (1 - u * u) * size * 4.2 * rnd.uniform(0.15, 1)
        pts.append((cx + u * w * 0.44, cy - height + size * 0.3))
    # draw lower items first so the mound reads front-to-back
    pts.sort(key=lambda p: -p[1])
    for x, y in pts:
        k, f, s = kind, fill, stroke
        if kind == "mix":
            k = rnd.choice(["almond", "cashew", "raisin", "pistachio"])
            f, s = rnd.choice(MIX_COLORS)
        parts.append(shape(k, x, y, size * rnd.uniform(0.85, 1.15), rnd.uniform(0, 360), f, s))
    return "\n".join(parts)


BRASS_DEFS = """<defs>
<linearGradient id="brass" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#6E4A1A"/><stop offset="0.35" stop-color="#C9973F"/><stop offset="0.55" stop-color="#F0D49A"/><stop offset="0.8" stop-color="#B07D2E"/><stop offset="1" stop-color="#5E3D14"/></linearGradient>
<linearGradient id="rim" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#8A5E22"/><stop offset="0.5" stop-color="#F6DFA8"/><stop offset="1" stop-color="#8A5E22"/></linearGradient>
<radialGradient id="glow" cx="0.5" cy="0.42" r="0.6"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.75"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<radialGradient id="velvet" cx="0.3" cy="0.2" r="0.9"><stop offset="0" stop-color="#0F4A3A"/><stop offset="0.6" stop-color="#082C22"/><stop offset="1" stop-color="#041A14"/></radialGradient>
</defs>"""


def brass_bowl(cx, cy, rx, depth, rim_ry):
    return (f'<ellipse cx="{cx}" cy="{cy+depth+8}" rx="{rx*0.95:.0f}" ry="{rim_ry*0.9:.0f}" fill="#000" opacity="0.18"/>'
            f'<path d="M{cx-rx},{cy} Q{cx-rx*0.92:.0f},{cy+depth} {cx},{cy+depth+4} Q{cx+rx*0.92:.0f},{cy+depth} {cx+rx},{cy}Z" fill="url(#brass)"/>'
            f'<path d="M{cx-rx*0.7:.0f},{cy+depth*0.45:.0f} Q{cx},{cy+depth*0.75:.0f} {cx+rx*0.7:.0f},{cy+depth*0.45:.0f}" stroke="#5E3D14" stroke-width="2" fill="none" opacity="0.5"/>'
            f'<path d="M{cx-rx*0.55:.0f},{cy+depth*0.62:.0f} Q{cx},{cy+depth*0.86:.0f} {cx+rx*0.55:.0f},{cy+depth*0.62:.0f}" stroke="#F6DFA8" stroke-width="1.5" fill="none" opacity="0.6"/>'
            f'<ellipse cx="{cx}" cy="{cy}" rx="{rx}" ry="{rim_ry}" fill="none" stroke="url(#rim)" stroke-width="6"/>')


def product_svg(key, bg, fill, stroke, kind, label):
    w = h = 800
    cx, cy = 400, 470
    items = bowl_items(kind, fill, stroke, cx, cy, 520, 34 if kind != "box" else 5, 34 if kind not in ("seed", "box") else (22 if kind == "seed" else 70), key)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{label} placeholder illustration">
{BRASS_DEFS}
<rect width="{w}" height="{h}" fill="{bg}"/>
<g fill="none" stroke="#B8893B" stroke-opacity="0.12">{''.join(f'<circle cx="400" cy="380" r="{r}"/>' for r in (150, 210, 270, 330))}</g>
<rect width="{w}" height="{h}" fill="url(#glow)"/>
<ellipse cx="{cx}" cy="{cy}" rx="262" ry="22" fill="#0A3328"/>
{items}
{brass_bowl(cx, cy, 270, 170, 26)}
<text x="400" y="730" text-anchor="middle" font-family="Georgia, serif" font-size="34" letter-spacing="6" fill="#0A3328">{label.upper()}</text>
<text x="400" y="764" text-anchor="middle" font-family="Arial, sans-serif" font-size="14" letter-spacing="5" fill="#96701F">PLACEHOLDER IMAGE</text>
</svg>
'''


def hero_svg(name, bg, accent, kinds, seed, w=1000, h=1250):
    rnd = random.Random(seed)
    parts = []
    positions = [(500, 640, 300), (300, 940, 220), (720, 960, 220)]
    for (kind, fill, stroke), (cx, cy, rx) in zip(kinds, positions):
        parts.append(bowl_items(kind, fill, stroke, cx, cy, rx * 1.9, 18, rx / 8, seed + cx))
        parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="{rx-8}" ry="{rx/11:.0f}" fill="#2A180C"/>' if False else "")
        parts.append(brass_bowl(cx, cy, rx, rx * 0.62, rx / 10))
    mandala = "".join(
        f'<ellipse cx="500" cy="330" rx="{r}" ry="{r}" fill="none" stroke="#DCC08A" stroke-opacity="{0.25 - r/2000:.2f}" stroke-dasharray="{2 + r/40:.0f} 6"/>'
        for r in range(60, 420, 45)
    )
    petals = "".join(
        f'<path transform="rotate({a} 500 330)" d="M500 200 C520 260 520 300 500 330 C480 300 480 260 500 200Z" fill="none" stroke="#DCC08A" stroke-opacity="0.35"/>'
        for a in range(0, 360, 30)
    )
    dust = "".join(f'<circle cx="{rnd.randint(0, w)}" cy="{rnd.randint(0, h)}" r="{rnd.uniform(0.8, 2.4):.1f}" fill="#DCC08A" opacity="{rnd.uniform(0.15, 0.5):.2f}"/>' for _ in range(90))
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="Placeholder artwork">
{BRASS_DEFS}
<rect width="{w}" height="{h}" fill="url(#velvet)"/>
{mandala}{petals}{dust}
<path d="M0,1080 Q500,1010 1000,1080 L1000,{h} L0,{h}Z" fill="#0D5A44" opacity="0.55"/>
{''.join(parts)}
<text x="500" y="1215" text-anchor="middle" font-family="Arial, sans-serif" font-size="15" letter-spacing="5" fill="#DCC08A" opacity="0.6">PLACEHOLDER ARTWORK</text>
</svg>
'''


for key, (bg, fill, stroke, kind, label) in ITEMS.items():
    (OUT / f"{key}.svg").write_text(product_svg(key, bg, fill, stroke, kind, label))
for key, (bg, contents, label) in JARS.items():
    (OUT / f"{key}.svg").write_text(jar_svg(bg, contents, label))

(OUT / "hero-hampers.svg").write_text(hero_svg("hampers", "", "", [("box", "#D4A64E", "#7A5A1E"), ("almond", "#B9774A", "#7A4A2A"), ("cashew", "#EBD3A8", "#B8955C")], 7))
(OUT / "hero-nuts.svg").write_text(hero_svg("nuts", "", "", [("walnut", "#C49A6C", "#7E5A36"), ("pistachio", "#C9B98E", "#7F8C4E"), ("almond", "#B9774A", "#7A4A2A")], 11))
(OUT / "heritage.svg").write_text(hero_svg("heritage", "", "", [("mix", "", ""), ("date", "#6B3A22", "#3F2013"), ("raisin", "#C9862B", "#8A5313")], 19))
(OUT / "product.svg").write_text(product_svg("product", "#F6EEE1", "#B9774A", "#7A4A2A", "mix", "Image coming soon"))
print("generated", len(list(OUT.glob("*.svg"))), "files")
