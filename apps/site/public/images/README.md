# Landing page images

Each frame is a `<picture>`: browsers take the `.webp`, and the original `.png`
stays as the fallback source. Vite serves `public/` at the site root, so
`public/images/hero.png` resolves to `/images/hero.png`.

| Slot | PNG (source) | WebP (served) | Aspect | Used by |
|---|---|---|---|---|
| Hero | `full_hero.png` | `full_hero.webp` | 16:9 → cover-cropped | Hero, full viewport |
| Corridor | `hero.png` | `hero.webp` | 16:9 → cropped to 4:3 | "Measured where the walk to school happens" |
| Network | `network.png` | `network.webp` | 3:2 → cropped to 4:3 | "Forty-five stations" |
| Schools | `school.png` | `school.webp` | 4:3 | "Fifteen of them go inside the gate" |
| Health | `health.png` | `health.webp` | 12:5 | "Does the corridor outside…" |

`logo.png` is the exception to the table: a 292px transparent PNG of the flame
mark, sized down in CSS beside the wordmark in the header and the footer, and
served whole as the apple-touch icon. The app carries its own copy at
`apps/web/src/assets/logo.png` because it is bundled by Vite rather than served
from this directory — replace both together.

The favicons are 64px reductions of it, at `public/favicon.png` and
`apps/web/src/assets/favicon.png` (5 KB rather than the source's 47 KB, which a
tab icon does not need). Regenerate both after replacing the logo:

```sh
python - <<'PY'
from PIL import Image
src = Image.open('apps/site/public/images/logo.png').convert('RGBA')
icon = src.resize((64, 64), Image.LANCZOS)
for out in ('apps/site/public/favicon.png', 'apps/web/src/assets/favicon.png'):
    icon.save(out, 'PNG', optimize=True)
PY
```

The corridor frame matches the schools frame at 4:3, so its 16:9 source loses a
quarter of its width. `.frame-corridor` sets `object-position: 20%` to hold the
crop window over the children walking the verge, who sit in the left third — a
centred crop clips them. A replacement corridor photograph needs its subject in
the same place, or that percentage needs re-checking.

## Regenerating the WebP files

Run after replacing any PNG. Requires Pillow (`pip install pillow`).

```sh
python - <<'PY'
from PIL import Image
d = 'apps/site/public/images/'
for f, w in [('full_hero.png',1672),('hero.png',1672),('network.png',1400),('school.png',1400),('health.png',1942)]:
    im = Image.open(d + f)
    if im.width > w:
        im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(d + f.replace('.png', '.webp'), 'WEBP', quality=82, method=6)
PY
```

This took the four originals from 7.4 MB to 589 KB. The hero is the LCP element
and the page targets under 2.0s on 4G, so keep it near 160 KB — if a replacement
comes in heavier, drop quality to ~78 before raising the budget.

## Replacing an image

- Warm, slightly desaturated grading sits best on the cornsilk palette for the
  in-page frames. The hero is the exception: it carries a dark scrim and
  inverted type, so it can be cool and low-key.
- The hero is cover-cropped to the viewport at every aspect ratio. Keep its
  subject centred and clear of the outer 15%, and keep the area behind the
  centred headline free of fine detail.
- `network.png` is 3:2 and is centre-cropped to 4:3 by `object-fit: cover`, so
  it matches `school.png` in the split layout. Keep its subject centred.
- Do not use imagery that identifies an individual child — faces should be
  distant, turned, or motion-blurred. See `docs/data-protection-statement.md`.
