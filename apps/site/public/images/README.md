# Landing page images

Each frame is a `<picture>`: browsers take the `.webp`, and the original `.png`
stays as the fallback source. Vite serves `public/` at the site root, so
`public/images/hero.png` resolves to `/images/hero.png`.

| Slot | PNG (source) | WebP (served) | Aspect | Used by |
|---|---|---|---|---|
| Hero | `hero.png` | `hero.webp` | 16:9 | Hero, full width |
| Network | `network.png` | `network.webp` | 3:2 → cropped to 4:3 | "Forty-five stations" |
| Schools | `school.png` | `school.webp` | 4:3 | "One sentence, each morning" |
| Health | `health.png` | `health.webp` | 12:5 | "Does the corridor outside…" |

## Regenerating the WebP files

Run after replacing any PNG. Requires Pillow (`pip install pillow`).

```sh
python - <<'PY'
from PIL import Image
d = 'apps/site/public/images/'
for f, w in [('hero.png',1672),('network.png',1400),('school.png',1400),('health.png',1942)]:
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

- Keep the subject clear of the outer 5%. Every frame runs through a torn-paper
  SVG displacement filter that eats roughly 14px into each edge.
- Warm, slightly desaturated grading sits best on the cornsilk palette. Strong
  blues and teals fight the earth tones.
- `network.png` is 3:2 and is centre-cropped to 4:3 by `object-fit: cover`, so
  it matches `school.png` in the split layout. Keep its subject centred.
- Do not use imagery that identifies an individual child — faces should be
  distant, turned, or motion-blurred. See `docs/data-protection-statement.md`.
