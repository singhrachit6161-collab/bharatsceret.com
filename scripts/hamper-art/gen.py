"""Generates the original Build-Your-Own-Hamper artwork sources (SVG + HTML).

Run:  python3 scripts/hamper-art/gen.py <outdir>
Then: node scripts/hamper-art/render.mjs <outdir> public/brand/hamper
(render.mjs needs playwright-core and a Chromium binary.)
All artwork is drawn from scratch: no third-party assets.
"""
import math, os, random, sys

OUT = sys.argv[1] if len(sys.argv) > 1 else "hamper-art-out"
os.makedirs(OUT, exist_ok=True)
random.seed(7)

WALNUT, EMERALD, GOLD, GOLD_L, IVORY = "#08281f", "#0d5a44", "#b8893b", "#dcc08a", "#faf6ef"

DEFS = f"""
<defs>
  <linearGradient id="gold" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#7a5520"/><stop offset=".3" stop-color="{GOLD_L}"/>
    <stop offset=".5" stop-color="#f6e7bd"/><stop offset=".7" stop-color="{GOLD}"/><stop offset="1" stop-color="#6e4b1a"/>
  </linearGradient>
  <linearGradient id="goldv" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#f6e7bd"/><stop offset=".45" stop-color="{GOLD}"/><stop offset="1" stop-color="#6e4b1a"/>
  </linearGradient>
  <radialGradient id="emer" cx=".5" cy=".38" r=".7">
    <stop offset="0" stop-color="#17795a"/><stop offset=".55" stop-color="{EMERALD}"/><stop offset="1" stop-color="{WALNUT}"/>
  </radialGradient>
  <radialGradient id="glow" cx=".5" cy=".5" r=".5">
    <stop offset="0" stop-color="#f6e7bd" stop-opacity=".55"/><stop offset="1" stop-color="#f6e7bd" stop-opacity="0"/>
  </radialGradient>
  <linearGradient id="silk" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fffaf0"/><stop offset=".5" stop-color="#efe2c6"/><stop offset="1" stop-color="#fbf4e4"/>
  </linearGradient>
  <linearGradient id="almond" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#c58a5a"/><stop offset=".6" stop-color="#9a5f34"/><stop offset="1" stop-color="#6d3f1f"/>
  </linearGradient>
  <linearGradient id="cashew" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#fbeccb"/><stop offset="1" stop-color="#dcbd86"/>
  </linearGradient>
  <linearGradient id="pista" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#b9c76a"/><stop offset="1" stop-color="#6e8a2e"/>
  </linearGradient>
  <filter id="soft" x="-20%" y="-20%" width="140%" height="140%"><feDropShadow dx="0" dy="6" stdDeviation="8" flood-color="#000" flood-opacity=".35"/></filter>
</defs>"""


def sparkle(x, y, s, op=1.0):
    return (f'<path transform="translate({x} {y}) scale({s})" fill="url(#gold)" opacity="{op}" '
            'd="M0-10C1.2-2.5 2.5-1.2 10 0 2.5 1.2 1.2 2.5 0 10-1.2 2.5-2.5 1.2-10 0-2.5-1.2-1.2-2.5 0-10Z"/>')


def medallion_frame():
    """Emerald medallion with a jewelled gold rim (viewBox 0 0 400 400)."""
    beads = "".join(
        f'<circle cx="{200 + 178 * math.cos(a):.1f}" cy="{200 + 178 * math.sin(a):.1f}" r="3.2" fill="url(#gold)"/>'
        for a in [i * math.tau / 48 for i in range(48)]
    )
    petals = "".join(
        f'<path transform="rotate({i * 15} 200 200)" d="M200 6c6 8 6 14 0 18-6-4-6-10 0-18Z" fill="url(#gold)"/>'
        for i in range(24)
    )
    return f"""
  <circle cx="200" cy="200" r="196" fill="{WALNUT}"/>
  {petals}
  <circle cx="200" cy="200" r="186" fill="url(#emer)" stroke="url(#gold)" stroke-width="5"/>
  {beads}
  <circle cx="200" cy="200" r="168" fill="none" stroke="{GOLD_L}" stroke-opacity=".55" stroke-width="1.2"/>
  <circle cx="200" cy="200" r="150" fill="url(#glow)" opacity=".6"/>
  <g fill="none" stroke="{GOLD_L}" stroke-opacity=".12">{''.join(f'<path transform="rotate({i*30} 200 200)" d="M200 60c30 40 30 80 0 110-30-30-30-70 0-110Z"/>' for i in range(12))}</g>
"""


def svg(body, w=400, h=400):
    return f'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 {w} {h}" width="{w}" height="{h}">{DEFS}{body}</svg>'


def jali(x, y, w, h, step=18):
    """Quatrefoil lattice clipped to a rectangle."""
    out = [f'<clipPath id="jc{x}{y}"><rect x="{x}" y="{y}" width="{w}" height="{h}"/></clipPath><g clip-path="url(#jc{x}{y})" fill="none" stroke="url(#gold)" stroke-width="1.6">']
    for i in range(int(w / step) + 2):
        for j in range(int(h / step) + 2):
            cx, cy = x + i * step, y + j * step
            r = step * 0.32
            out.append(f'<path d="M{cx} {cy - r * 1.4}q{r} {r * 1.4} 0 {r * 2.8}q{-r} {-r * 1.4} 0 {-r * 2.8}Z M{cx - r * 1.4} {cy}q{r * 1.4} {r} {r * 2.8} 0q{-r * 1.4} {-r} {-r * 2.8} 0Z"/>')
    out.append("</g>")
    return "".join(out)


def almond(x, y, rot, s=1.0):
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({s})"><path d="M0-15C9-9 10 6 0 15-10 6-9-9 0-15Z" fill="url(#almond)" stroke="#5a3218" stroke-width=".8"/>'
            '<path d="M-2-9C-4-2-4 4-1 10M3-8C4-1 3 5 1 10" stroke="#e2b48a" stroke-opacity=".45" stroke-width=".9" fill="none"/></g>')


def cashew(x, y, rot, s=1.0):
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({s})"><path d="M-12-6C-14 8 0 16 10 10 14 7 13 2 9 1 5 0 3 6-3 4-7 3-6-6-12-6Z" '
            'fill="url(#cashew)" stroke="#b8935a" stroke-width=".8"/></g>')


def pista(x, y, rot, s=1.0):
    return (f'<g transform="translate({x} {y}) rotate({rot}) scale({s})"><ellipse rx="10" ry="7" fill="#e9dcbc" stroke="#b9a173" stroke-width=".8"/>'
            '<ellipse rx="6.5" ry="4.5" fill="url(#pista)"/></g>')


# ---------- Step medallions ----------
step1 = svg(medallion_frame() + f"""
  <g filter="url(#soft)">
    <!-- opened lid -->
    <path d="M118 196 L136 104 H264 L282 196 Z" fill="{WALNUT}" stroke="url(#gold)" stroke-width="4" stroke-linejoin="round"/>
    {jali(140, 112, 120, 76, 20)}
    <path d="M136 104 H264" stroke="url(#gold)" stroke-width="6"/>
    <!-- silk lining and treasures -->
    <path d="M114 200 Q200 168 286 200 L286 214 H114 Z" fill="url(#silk)"/>
    <circle cx="156" cy="198" r="15" fill="url(#gold)" stroke="#6e4b1a"/><circle cx="156" cy="198" r="9" fill="none" stroke="#6e4b1a" stroke-opacity=".5"/>
    <circle cx="200" cy="192" r="17" fill="url(#gold)" stroke="#6e4b1a"/><circle cx="200" cy="192" r="10" fill="none" stroke="#6e4b1a" stroke-opacity=".5"/>
    <circle cx="244" cy="198" r="15" fill="url(#gold)" stroke="#6e4b1a"/><circle cx="244" cy="198" r="9" fill="none" stroke="#6e4b1a" stroke-opacity=".5"/>
    <!-- box body -->
    <rect x="108" y="206" width="184" height="96" rx="4" fill="{WALNUT}" stroke="url(#gold)" stroke-width="4"/>
    <rect x="120" y="218" width="160" height="72" fill="none" stroke="{GOLD_L}" stroke-opacity=".5" stroke-width="1.2"/>
    {jali(124, 222, 152, 64, 16)}
    <path d="M188 240h24v20a12 12 0 0 1-24 0Z" fill="url(#gold)" stroke="#6e4b1a"/>
    <circle cx="200" cy="252" r="3" fill="{WALNUT}"/>
    <rect x="100" y="300" width="200" height="10" rx="3" fill="url(#gold)"/>
  </g>
  {sparkle(118, 92, 1.2)}{sparkle(292, 120, .9)}{sparkle(276, 78, .6, .8)}
""")

nuts = []
for i in range(40):
    a = random.uniform(math.pi * 1.05, math.pi * 1.95)
    r = random.uniform(0, 88)
    x = 200 + math.cos(a) * r * 1.25
    y = 208 + math.sin(a) * r * 0.78
    k = i % 3
    nuts.append((y, [almond, cashew, pista][k](round(x, 1), round(y, 1), random.randint(0, 360), random.uniform(1.1, 1.4))))
nuts.sort()
step2 = svg(medallion_frame() + f"""
  <g filter="url(#soft)">
    <path d="M244 196c34-44 74-44 84-34-18 4-40 34-84 34Z" fill="#2f7a4f" stroke="url(#gold)" stroke-width="1.5"/>
    <path d="M156 196c-34-44-74-44-84-34 18 4 40 34 84 34Z" fill="#256b45" stroke="url(#gold)" stroke-width="1.5"/>
    {''.join(n for _, n in nuts)}
    <path d="M104 204 Q200 222 296 204 Q292 280 200 292 Q108 280 104 204 Z" fill="url(#goldv)" stroke="#6e4b1a" stroke-width="2"/>
    <path d="M104 204 Q200 222 296 204" fill="none" stroke="#f6e7bd" stroke-width="3"/>
    <path d="M124 236 Q200 252 276 236" fill="none" stroke="#6e4b1a" stroke-opacity=".35" stroke-width="1.5"/>
    <path d="M140 262 Q200 274 260 262" fill="none" stroke="#f6e7bd" stroke-opacity=".55" stroke-width="1.5"/>
    <ellipse cx="200" cy="300" rx="44" ry="8" fill="url(#gold)"/>
  </g>
  {sparkle(110, 150, 1.0)}{sparkle(300, 168, .8)}{sparkle(200, 100, .7, .9)}
""")

step3 = svg(medallion_frame() + f"""
  <g filter="url(#soft)">
    <g transform="rotate(-7 200 210)">
      <rect x="106" y="140" width="188" height="132" rx="4" fill="{IVORY}" stroke="url(#gold)" stroke-width="4"/>
      <rect x="116" y="150" width="168" height="112" fill="none" stroke="{GOLD}" stroke-opacity=".6" stroke-width="1"/>
      <path d="M106 144 L200 214 L294 144" fill="none" stroke="url(#gold)" stroke-width="3.5"/>
      <path d="M106 272 L178 206 M294 272 L222 206" stroke="{GOLD}" stroke-opacity=".5" stroke-width="2"/>
    </g>
    <!-- wax seal -->
    <g transform="translate(200 214)">
      <path d="M0-34 C10-36 16-28 24-26 32-20 30-10 34-2 34 8 26 12 24 20 18 30 8 28 0 34-8 30-18 30-24 22-30 14-34 8-34-2-32-12-30-20-24-26-16-30-10-36 0-34Z" fill="#7b1e22"/>
      <circle r="24" fill="#951f26" stroke="#5b1013" stroke-width="2"/>
      <circle r="19" fill="none" stroke="#c9584f" stroke-opacity=".7" stroke-width="1.2"/>
      {''.join(f'<path transform="rotate({i*45})" d="M0-15c4 5 4 9 0 12-4-3-4-7 0-12Z" fill="#c9584f" fill-opacity=".85"/>' for i in range(8))}
      <circle r="3.5" fill="#e07a6d"/>
    </g>
    <!-- ribbon -->
    <path d="M200 248 l-26 40 12-2 6 12 12-36Z M200 248 l26 40-12-2-6 12-12-36Z" fill="#951f26" stroke="#5b1013" stroke-width="1"/>
  </g>
  {sparkle(116, 120, 1.0)}{sparkle(296, 112, .8)}{sparkle(306, 290, .6, .9)}
""")

# ---------- Gift card (ivory, 1000 x 640) ----------
def corner(tx, ty, rot):
    return f"""<g transform="translate({tx} {ty}) rotate({rot})" fill="none" stroke="url(#gold)" stroke-width="2.2">
      <path d="M0 0 C40 4 70 20 86 56"/><path d="M0 0 C4 40 20 70 56 86"/>
      <path d="M22 22 C40 22 52 30 58 46 C44 40 30 38 22 22Z" fill="url(#gold)" stroke="none"/>
      <path d="M34 8 c10 2 16 8 18 18 M8 34 c2 10 8 16 18 18"/>
      <circle cx="64" cy="64" r="4" fill="url(#gold)" stroke="none"/>
      <path d="M86 56 c10 22 30 30 52 26 M56 86 c22 10 30 30 26 52" stroke-width="1.4"/>
      <path d="M120 70 c8-10 20-10 26 0-8 6-18 6-26 0Z M70 120 c-10 8-10 20 0 26 6-8 6-18 0-26Z" fill="url(#gold)" stroke="none"/>
    </g>"""

card = svg(f"""
  <rect width="1000" height="640" fill="{IVORY}"/>
  <rect width="1000" height="640" fill="url(#paper)" opacity=".6"/>
  <rect x="24" y="24" width="952" height="592" fill="none" stroke="url(#gold)" stroke-width="5"/>
  <rect x="40" y="40" width="920" height="560" fill="none" stroke="{GOLD}" stroke-opacity=".7" stroke-width="1.2"/>
  <rect x="48" y="48" width="904" height="544" fill="none" stroke="{GOLD}" stroke-opacity=".35" stroke-width="1" stroke-dasharray="2 6"/>
  {corner(40, 40, 0)}{corner(960, 40, 90)}{corner(960, 600, 180)}{corner(40, 600, 270)}
  <g transform="translate(500 92)">
    <path d="M-200 0H-44M44 0H200" stroke="{GOLD}" stroke-width="1.5"/><circle cx="-206" r="3" fill="{GOLD}"/><circle cx="206" r="3" fill="{GOLD}"/>
    {''.join(f'<path transform="rotate({i*45})" d="M0-26c9 9 9 18 0 24-9-6-9-15 0-24Z" fill="url(#gold)"/>' for i in range(8))}
    <circle r="7" fill="{IVORY}" stroke="url(#gold)" stroke-width="2"/>
  </g>
  <g transform="translate(500 560)"><path d="M-140 0H-14M14 0H140" stroke="{GOLD}" stroke-width="1.2"/>
    <path d="M0-8 8 0 0 8-8 0Z" fill="url(#gold)"/></g>
""".replace("</defs>", "") , 1000, 640).replace(
    "</defs>",
    '<filter id="grain"><feTurbulence type="fractalNoise" baseFrequency=".9" numOctaves="2" seed="3"/><feColorMatrix values="0 0 0 0 .55  0 0 0 0 .45  0 0 0 0 .3  0 0 0 .06 0"/></filter>'
    '<pattern id="paper" width="1000" height="640" patternUnits="userSpaceOnUse"><rect width="1000" height="640" filter="url(#grain)"/></pattern></defs>', 1)

for name, content in {"step-1.svg": step1, "step-2.svg": step2, "step-3.svg": step3, "gift-card.svg": card}.items():
    with open(os.path.join(OUT, name), "w") as f:
        f.write(content)

# ---------- Hero composite (HTML; uses the brand's own box photographs) ----------
def chain(x, length):
    beads = "".join(f'<circle cx="{x}" cy="{y}" r="2.2" fill="url(#gold)"/>' for y in range(0, length, 9))
    return beads + f'<path transform="translate({x} {length + 10})" d="M0-12 10 4 0 22-10 4Z" fill="url(#gold)"/><circle cx="{x}" cy="{length + 38}" r="4" fill="url(#gold)"/>'

dust = "".join(sparkle(random.randint(40, 1560), random.randint(40, 960), round(random.uniform(.25, .8), 2), round(random.uniform(.25, .8), 2)) for _ in range(46))
overlay = svg(f"""
  {chain(330, 150)}{chain(1270, 150)}{chain(560, 70)}{chain(1040, 70)}
  {dust}
  <ellipse cx="800" cy="930" rx="720" ry="60" fill="url(#glow)" opacity=".7"/>
  <rect x="60" y="912" width="1480" height="6" fill="url(#gold)"/>
  <rect x="100" y="926" width="1400" height="2" fill="url(#gold)" opacity=".6"/>
  <g transform="translate(800 70)">
    {''.join(f'<path transform="rotate({a})" d="M0-40c14 14 14 30 0 40-14-10-14-26 0-40Z" fill="url(#gold)"/>' for a in (-60, -30, 0, 30, 60))}
    <circle r="9" fill="url(#gold)"/>
  </g>
""", 1600, 1000)

def arch(w, h, inset=0):
    w, h = w - 2 * inset, h - 2 * inset
    s = w * 0.62
    o = inset
    return (f"path('M{o} {o + h} V{o + s:.1f} C{o} {o + s * .42:.1f} {o + w * .36:.1f} {o + s * .2:.1f} {o + w / 2:.1f} {o} "
            f"C{o + w * .64:.1f} {o + s * .2:.1f} {o + w} {o + s * .42:.1f} {o + w} {o + s:.1f} V{o + h} Z')")


def arch_block(style, w, h, img, z=1):
    return (f'<div class="arch" style="{style};width:{w}px;height:{h}px;z-index:{z};clip-path:{arch(w, h)}">'
            f'<div class="in" style="clip-path:{arch(w, h, 9)}"><div class="ph" style="clip-path:{arch(w, h, 13)};background-image:url({img})"></div></div></div>')
hero = f"""<!doctype html><html><head><meta charset="utf-8"><style>
html,body{{margin:0;width:1600px;height:1000px;overflow:hidden}}
body{{background:{WALNUT};background-image:radial-gradient(ellipse at 50% 35%,rgba(23,121,90,.85),transparent 62%),radial-gradient(ellipse at 50% 100%,rgba(220,192,138,.25),transparent 55%),url(damask.svg);background-size:auto,auto,120px 120px;position:relative}}
.arch{{position:absolute;bottom:88px;background:linear-gradient(135deg,#7a5520,#dcc08a 30%,#f6e7bd 50%,#b8893b 70%,#6e4b1a)}}
.arch .in,.arch .ph{{position:absolute;inset:0;background:{WALNUT}}}
.arch .ph{{background-size:cover;background-position:center}}
svg.ov{{position:absolute;inset:0}}
</style></head><body>
{arch_block("left:170px", 400, 580, "floral-tin-box.webp")}
{arch_block("right:170px", 400, 580, "woven-box.webp")}
{arch_block("left:530px", 540, 780, "carved-casket.webp", 2)}
<div class="ov" style="position:absolute;inset:0;z-index:3">{overlay.replace('<svg ', '<svg class="ov" ')}</div>
</body></html>"""
with open(os.path.join(OUT, "hero.html"), "w") as f:
    f.write(hero)
print("wrote", OUT)
