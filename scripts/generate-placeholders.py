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
    "almonds": ("#F3E6D3", "#B9774A", "#7A4A2A", "almond", "Almonds"),
    "cashews": ("#F6EEDF", "#EBD3A8", "#B8955C", "cashew", "Cashews"),
    "walnuts": ("#EFE3D2", "#C49A6C", "#7E5A36", "walnut", "Walnuts"),
    "pistachios": ("#EEF0E2", "#C9B98E", "#7F8C4E", "pistachio", "Pistachios"),
    "raisins": ("#F7E9CF", "#C9862B", "#8A5313", "raisin", "Raisins"),
    "dates": ("#F1E2D6", "#6B3A22", "#3F2013", "date", "Dates"),
    "seeds": ("#EEF0E2", "#5E7044", "#3B4A2A", "seed", "Seeds"),
    "trail-mix": ("#F4E8D6", "#B9774A", "#7A4A2A", "mix", "Trail Mix"),
    "gift-hampers": ("#F1E4D0", "#C89136", "#38251D", "box", "Gift Hampers"),
    "apricots": ("#FBE7CF", "#E58A2E", "#A85A14", "round", "Apricots"),
    "figs": ("#F2E4D2", "#B48A5E", "#6E4C2C", "fig", "Dried Figs"),
    "cranberries": ("#F6DEDC", "#A3232E", "#661018", "raisin", "Cranberries"),
    "blueberries": ("#E7E4F0", "#2E2A5A", "#16133A", "round", "Blueberries"),
    "corn-nuts": ("#FBEBCB", "#E2A93B", "#A8701B", "round", "Corn Nuts"),
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
                f'<rect x="{x-r*0.12:.0f}" y="{y-r*0.8:.0f}" width="{r*0.24:.0f}" height="{r*1.6:.0f}" fill="#7A1F23"/>'
                f'<rect x="{x-r:.0f}" y="{y-r*0.12:.0f}" width="{r*2:.0f}" height="{r*0.24:.0f}" fill="#7A1F23"/></g>')
    return f'<circle cx="{x:.0f}" cy="{y:.0f}" r="{r:.0f}" fill="{fill}" stroke="{stroke}" stroke-width="3"/>'


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


def product_svg(key, bg, fill, stroke, kind, label):
    w = h = 800
    cx, cy = 400, 470
    items = bowl_items(kind, fill, stroke, cx, cy, 520, 34 if kind != "box" else 5, 34 if kind not in ("seed", "box") else (22 if kind == "seed" else 70), key)
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="{label} placeholder illustration">
<rect width="{w}" height="{h}" fill="{bg}"/>
<circle cx="400" cy="380" r="300" fill="#FFFFFF" opacity="0.35"/>
<ellipse cx="{cx}" cy="{cy+150}" rx="270" ry="34" fill="#38251D" opacity="0.12"/>
{items}
<path d="M{cx-270},{cy} Q{cx-250},{cy+170} {cx},{cy+175} Q{cx+250},{cy+170} {cx+270},{cy}Z" fill="#8A5A3B" stroke="#38251D" stroke-width="4"/>
<ellipse cx="{cx}" cy="{cy}" rx="270" ry="26" fill="#A06B47" stroke="#38251D" stroke-width="4"/>
<path d="M{cx-200},{cy+60} Q{cx},{cy+100} {cx+200},{cy+60}" stroke="#C89136" stroke-width="5" fill="none" opacity="0.7"/>
<text x="400" y="720" text-anchor="middle" font-family="Georgia, serif" font-size="40" fill="#38251D">{label}</text>
<text x="400" y="760" text-anchor="middle" font-family="Arial, sans-serif" font-size="18" letter-spacing="3" fill="#38251D" opacity="0.55">PLACEHOLDER IMAGE</text>
</svg>
'''


def hero_svg(name, bg, accent, kinds, seed):
    w, h = 1600, 640
    rnd = random.Random(seed)
    parts = []
    for i, (kind, fill, stroke) in enumerate(kinds):
        cx = 930 + i * 250
        cy = 380 + (i % 2) * 50
        parts.append(f'<ellipse cx="{cx}" cy="{cy+95}" rx="150" ry="20" fill="#000" opacity="0.18"/>')
        parts.append(bowl_items(kind, fill, stroke, cx, cy, 300, 16, 22, seed + i))
        parts.append(f'<path d="M{cx-150},{cy} Q{cx-140},{cy+95} {cx},{cy+98} Q{cx+140},{cy+95} {cx+150},{cy}Z" fill="#8A5A3B" stroke="#1E130E" stroke-width="3"/>')
        parts.append(f'<ellipse cx="{cx}" cy="{cy}" rx="150" ry="16" fill="#A06B47" stroke="#1E130E" stroke-width="3"/>')
    pattern = "".join(
        f'<circle cx="{rnd.randint(0, w)}" cy="{rnd.randint(0, h)}" r="{rnd.randint(2, 5)}" fill="{accent}" opacity="0.25"/>'
        for _ in range(70)
    )
    return f'''<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" role="img" aria-label="Placeholder banner artwork">
<rect width="{w}" height="{h}" fill="{bg}"/>
{pattern}
<path d="M0,560 Q400,500 800,560 T1600,540 L1600,640 L0,640Z" fill="#000" opacity="0.12"/>
<g opacity="0.9">{''.join(parts)}</g>
<text x="1560" y="620" text-anchor="end" font-family="Arial, sans-serif" font-size="16" letter-spacing="3" fill="#FFF9F0" opacity="0.6">PLACEHOLDER ARTWORK</text>
</svg>
'''


for key, (bg, fill, stroke, kind, label) in ITEMS.items():
    (OUT / f"{key}.svg").write_text(product_svg(key, bg, fill, stroke, kind, label))

(OUT / "hero-hampers.svg").write_text(hero_svg("hampers", "#38251D", "#C89136", [("box", "#C89136", "#38251D"), ("almond", "#B9774A", "#7A4A2A"), ("cashew", "#EBD3A8", "#B8955C")], 7))
(OUT / "hero-nuts.svg").write_text(hero_svg("nuts", "#7A4F1E", "#FFF9F0", [("walnut", "#C49A6C", "#7E5A36"), ("pistachio", "#C9B98E", "#7F8C4E"), ("almond", "#B9774A", "#7A4A2A")], 11))
(OUT / "product.svg").write_text(product_svg("product", "#F3E6D3", "#B9774A", "#7A4A2A", "mix", "Image coming soon"))
print("generated", len(list(OUT.glob("*.svg"))), "files")
