# aqi.thingsnode — Application & Design Specification

**Version:** 0.1 — MVP build spec
**Date:** 29 July 2026
**Companion document:** BreathSafe-LK-Product-Spec.md (product strategy, data sources, phasing)
**Status:** Ready for design and build

---

## 1. What this application is

A public air quality platform for Sri Lanka. It brings together readings from our own
traffic-corridor stations and from existing public networks, and presents them so that
a school administrator, a parent, or a researcher can see what the air is doing and
decide what to do about it.

**Primary user:** a school administrator, on a phone, with about thirty seconds.

**The single job of the home screen:** show what the air is like here, now, and how it
moves through the day.

### Editorial stance

The application shows the Sri Lanka AQI and the WHO guideline comparison **side by
side, with equal weight**. It does not tell the user which one to believe, and it does
not editorialise when the two disagree. Both numbers are presented as facts with their
scales named, and the user draws their own conclusion.

The only place the app states a plain conclusion is when levels are poor against the
WHO guideline by a wide margin — in which case it says so directly, once, without
embellishment.

---

## 2. Reference facts

Stated plainly, for use in the interface. No rhetorical framing.

### Sri Lanka AQI

Derived from the aq.cea.lk API payload and cross-checked against the NBRO daily
bulletin. Verified across the observed range (SL AQI 20–56); to be re-verified at
higher concentrations when haze-season data is available.

```
SL_AQI_PM25 = round(2 × PM2.5_µg_m3)
SL_AQI_PM10 = round(1 × PM10_µg_m3)
```

| Band | SL AQI | PM2.5 (µg/m³) | PM10 (µg/m³) |
|---|---|---|---|
| Good | 0–50 | 0–25 | 0–50 |
| Moderate | 51–100 | 25–50 | 51–100 |
| Slightly Unhealthy | 101–150 | 50–75 | 101–150 |
| Unhealthy | 151–200 | 75–100 | 151–200 |
| Very Unhealthy | 201–300 | 100–150 | 201–300 |
| Hazardous | 301–500 | 150–250 | 301–500 |

### WHO guidelines (2021)

| Pollutant | Averaging period | Guideline |
|---|---|---|
| PM2.5 | 24-hour | 15 µg/m³ |
| PM2.5 | Annual | 5 µg/m³ |
| PM10 | 24-hour | 45 µg/m³ |
| PM10 | Annual | 15 µg/m³ |

WHO status is expressed as **Within guideline** or **Above guideline**, with the
measured value and the guideline value both shown. No multipliers, no adjectives.

### Diurnal pattern

Concentrations vary through the day. Rather than asserting fixed peak hours, the
application **displays the observed pattern on a time axis** and lets the shape speak
for itself. Where a peak window is called out in text, it is derived from that
station's own recent data and labelled as such ("based on the last 14 days at this
station").

---

## 3. Design direction

### 3.1 Concept

**A physical model of the city, with the air made visible above it.**

The map renders as a pale architectural model — buildings extruded in warm off-white,
like a foam-core study model on a desk. Air quality is not painted onto the buildings.
It sits *above* them, as a translucent volume and as vertical columns rising from each
station. The interface panels are warm, solid, tactile cards resting over the model,
like instrument readouts laid on the same desk.

This is the thesis of the whole product expressed in one image: the invisible thing
made visible, sitting in the space where people actually breathe.

### 3.2 Signature element — the Exposure Column

Each station is a translucent vertical column rising from the map surface.

- **Colour** = the current AQI band
- **Height** = cumulative exposure across the selected window (default 7 days)
- **A thin horizontal ring** marks where the WHO 24-hour guideline level sits on
  that column

So a corridor can read green today and still stand visibly tall. The user sees
accumulated dose and current condition at the same time, without a word of
commentary. This is the one bold element; everything else stays quiet.

Columns animate upward on load, staggered by 40 ms, easing out over 700 ms. Disabled
entirely under `prefers-reduced-motion`, where they render at final height.

### 3.3 What this design deliberately avoids

- **Glassmorphism.** It is the default in every air-quality app reference and it
  reads as generic. Cards are solid, warm, and physically shadowed instead.
- **Gradient-filled hero numbers.** The big number is set in type, on a flat card.
- **Colour-only meaning.** Every band colour is always accompanied by its band name
  in text.
- **Emoji or face icons for air quality.** This is a health tool used by
  institutions; smiley faces undercut it.

---

## 4. Design system

### 4.1 Colour

#### Platform palette — interface chrome

```css
:root {
  --cornsilk:      #FEFAE0;  /* app background, map base */
  --papaya-whip:   #FAEDCD;  /* card surfaces */
  --beige:         #E9EDC9;  /* secondary surfaces, muted panels */
  --tea-green:     #CCD5AE;  /* borders, active states, quiet accents */
  --light-bronze:  #D4A373;  /* primary action, emphasis, links */
}
```

#### Derived neutrals

The supplied palette contains no text colour. These are derived from it and are part
of the system.

```css
:root {
  --ink:           #3A342B;  /* primary text — warm near-black */
  --ink-muted:     #7A7263;  /* secondary text, labels */
  --ink-faint:     #A99F8C;  /* tertiary, disabled, axis labels */
  --hairline:      #E4DCC4;  /* 1px dividers */
  --shadow-warm:   rgba(90, 74, 48, 0.10);
}
```

#### AQI scale — data only

```css
:root {
  --aqi-good:               #8EBD96;  /* 0–50    */
  --aqi-moderate:           #D8DC82;  /* 51–100  */
  --aqi-slightly-unhealthy: #FED665;  /* 101–150 */
  --aqi-unhealthy:          #FA9D45;  /* 151–200 */
  --aqi-very-unhealthy:     #E76E6B;  /* 201–300 */
  --aqi-hazardous:          #9A5D7C;  /* 301–500 */
}
```

**Rule, strictly enforced:** AQI scale colours are used *only* for data — columns,
map overlay, band chips, chart fills, the ribbon. They are never used for buttons,
navigation, links, or any interface chrome. Otherwise a green button becomes
indistinguishable from a reading.

**Contrast:** `--aqi-moderate` and `--aqi-slightly-unhealthy` are too light for text
on cornsilk. Band colour never carries meaning alone — it is always paired with the
band name. Where a band colour must sit behind text, use `--ink` on it and verify
4.5:1.

### 4.2 Typography

```css
--font-primary: 'Nunito', system-ui, sans-serif;
--font-mono:    ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace;
--font-si:      'Noto Sans Sinhala', sans-serif;
--font-ta:      'Noto Sans Tamil', sans-serif;
```

**Nunito** carries the entire interface — display, body and data. It is a variable
family (wght 200–1000) with rounded terminals, and its full weight range is the
instrument for hierarchy here: contrast comes from weight and size, not from mixing
families. This keeps the interface calm and consistent, which suits a tool that
institutions will look at every day.

Nunito's rounded, humanist warmth pairs naturally with the earthy platform palette.
The modern edge in this design comes from the 3D model and the exposure columns, not
from the type — the type's job is to stay quiet and legible.

**Numerals.** Nunito supports tabular figures. Every number that appears in a column,
axis, table or live-updating readout must set `font-variant-numeric: tabular-nums` so
values do not jitter as they change.

```css
.numeric { font-variant-numeric: tabular-nums; font-feature-settings: 'tnum' 1; }
```

**Monospace** is used only for genuinely machine-facing text: station identifiers,
coordinates, API examples on the docs pages. A system stack is fine; do not load a
second webfont for it.

**Noto Sans Sinhala / Tamil** for the two other official languages. Nunito has no
Sinhala or Tamil coverage, and Noto's terminals are not rounded — so the scripts will
not match perfectly. Compensate by setting Noto one weight step lighter than the
Nunito weight it sits beside, and give Sinhala additional line height. Verify the
full type scale in all three scripts before the layouts are finalised; this is much
cheaper to fix in the scale than in the screens.

#### Type scale

All weights refer to Nunito's variable axis.

| Token | Size / line-height | Weight | Use |
|---|---|---|---|
| `display-xl` | 72 / 68 | 800 | Primary AQI number |
| `display-l` | 40 / 46 | 700 | Screen titles |
| `display-m` | 28 / 36 | 700 | Card headings |
| `body-l` | 17 / 27 | 400 | Primary reading text |
| `body-m` | 15 / 24 | 400 | Default body |
| `body-s` | 13 / 20 | 400 | Secondary |
| `label` | 12 / 16, +0.06em, uppercase | 600 | Field labels, eyebrows |
| `data-l` | 24 / 30, tabular | 700 | Secondary readings |
| `data-m` | 15 / 22, tabular | 500 | Values in tables |
| `data-s` | 12 / 16, tabular | 400 | Units, timestamps, axes |

Sinhala line-heights add 4px at every step. Tamil adds 2px.

#### Wordmark

Text only, as requested. Set in Nunito, lowercase, weight 700,
letter-spacing −0.02em.

```
aqi.thingsnode
```

`aqi.` in `--light-bronze`, `thingsnode` in `--ink`. Never all-caps, never with an
icon, never on an AQI band colour. Minimum size 16px. A single-colour version in
`--ink` exists for dark surfaces and print.

The wordmark is the one place a slightly tighter tracking is used; everywhere else
Nunito runs at its default spacing.

### 4.3 Space, radius, elevation

```css
--space-1: 4px;   --space-2: 8px;   --space-3: 12px;
--space-4: 16px;  --space-5: 24px;  --space-6: 32px;
--space-7: 48px;  --space-8: 64px;

--radius-s: 8px;   /* chips, inputs */
--radius-m: 14px;  /* cards */
--radius-l: 22px;  /* sheets, primary panels */
--radius-full: 999px;

/* Cards sit physically above the map — warm, soft, two-layer shadow */
--elev-1: 0 1px 2px rgba(90,74,48,0.06), 0 2px 8px rgba(90,74,48,0.05);
--elev-2: 0 2px 4px rgba(90,74,48,0.07), 0 8px 24px rgba(90,74,48,0.08);
--elev-3: 0 4px 8px rgba(90,74,48,0.08), 0 16px 48px rgba(90,74,48,0.10);
```

Cards are **opaque `--papaya-whip`** with `--elev-2`. No backdrop blur, no
transparency. They should read as objects resting on the model, not as glass.

### 4.4 Motion

| Interaction | Duration | Easing |
|---|---|---|
| Card enter | 320ms | `cubic-bezier(0.16, 1, 0.3, 1)` |
| Column grow | 700ms, 40ms stagger | `cubic-bezier(0.22, 1, 0.36, 1)` |
| Map pitch/fly | 1200ms | maplibre default ease |
| Ribbon scrub | 0ms (follows pointer) | — |
| Value change | 400ms count-up | `ease-out` |
| Hover lift | 160ms | `ease-out` |

All non-essential motion disabled under `prefers-reduced-motion: reduce`. Columns
render at final height, values appear without counting, the map loads already pitched.

---

## 5. The map

### 5.1 Base implementation

MapLibre GL with OpenFreeMap tiles and extruded buildings, per the supplied pattern.

```js
import * as maplibregl from 'https://unpkg.com/maplibre-gl@6.0.0/dist/maplibre-gl.mjs';

const map = new maplibregl.Map({
    style: 'https://tiles.openfreemap.org/styles/bright',
    center: [79.8612, 6.9271],       // Colombo
    zoom: 13.5,
    pitch: 50,
    bearing: -18,
    container: 'map',
    canvasContextAttributes: { antialias: true }
});

map.on('load', () => {
    const layers = map.getStyle().layers;
    let labelLayerId;
    for (let i = 0; i < layers.length; i++) {
        if (layers[i].type === 'symbol' && layers[i].layout['text-field']) {
            labelLayerId = layers[i].id;
            break;
        }
    }

    map.addSource('openfreemap', {
        url: 'https://tiles.openfreemap.org/planet',
        type: 'vector',
    });

    map.addLayer({
        id: '3d-buildings',
        source: 'openfreemap',
        'source-layer': 'building',
        type: 'fill-extrusion',
        minzoom: 14,
        filter: ['!=', ['get', 'hide_3d'], true],
        paint: {
            // Buildings stay neutral and pale. Air quality is never painted on them.
            'fill-extrusion-color': [
                'interpolate', ['linear'], ['get', 'render_height'],
                0,   '#FEFAE0',
                60,  '#F2EBD2',
                200, '#E4DCC4'
            ],
            'fill-extrusion-height': [
                'interpolate', ['linear'], ['zoom'],
                14, 0,
                15.5, ['get', 'render_height']
            ],
            'fill-extrusion-base': [
                'case',
                ['>=', ['get', 'zoom'], 16],
                ['get', 'render_min_height'],
                0
            ],
            'fill-extrusion-opacity': 0.92
        }
    }, labelLayerId);
});
```

### 5.2 Map style adjustments

The `bright` style must be recoloured toward the platform palette:

- Land: `--cornsilk`
- Water: `#DCE4D2` (desaturated tea-green)
- Roads: `#EFE7CE`, with corridor roads (our monitored routes) a shade darker at
  `#E4DCC4` and 1px wider
- Labels: `--ink-muted`, Instrument Sans
- Parks / green space: `--beige`

Buildings are deliberately neutral. If air quality is painted onto buildings, users
read it as "this building is polluted" rather than "this air is polluted."

### 5.3 Exposure Column layer

Custom layer, rendered above buildings.

```
Geometry:  cylinder, radius 14px screen-space at z=14, scaling with zoom
Height:    normalised cumulative exposure over the selected window
           h = clamp(cumulative_µg_m3_hours / reference_dose, 0.15, 1.0) × max_height
Colour:    current AQI band colour, 0.55 opacity, additive-ish blend
Cap:       solid disc in the band colour at 0.9 opacity
WHO ring:  1.5px ring in --ink at 0.35 opacity, positioned at the height that the
           WHO 24h guideline would produce for the same window
Label:     station name + SL AQI value on hover/tap
```

Stations from public feeds render with a **dashed cap outline** to distinguish them
from our own stations, which have a solid cap. Simulated stations in demo mode carry
the same dashed treatment plus the demo chip in the header — no other difference.

### 5.4 Volumetric air layer (optional, progressive enhancement)

A translucent horizontal plane at ~30 m model height, coloured by interpolated AQI
across the station network (IDW interpolation, 200 m grid). Opacity 0.18. Renders
only when three or more stations are in view and the device reports adequate GPU
capability. Falls back silently to columns alone.

This is the "air made visible" moment. It should be subtle — a tint over the model,
not a heat map.

### 5.5 2D fallback

A `2D` toggle sets `pitch: 0` and swaps columns for circular markers sized by
exposure and coloured by band. Required for low-end devices, and it is the default
on connections slower than 2G-equivalent.

---

## 6. Screens

### 6.0 Landing page

The first thing anyone sees. Its single job is to get the right person into the
application, and to make the project legible to the people who won't use it daily —
funders, ministry officials, journalists, potential contributors.

It is a separate static build. It does not load the map library, the WebSocket
client, or anything else from the application bundle.

#### Hero

The hero is not a stock photograph. It is **the product's own city model**: Colombo
extruded in warm off-white, exposure columns rising from the corridors, the camera
drifting slowly through a shallow arc.

This is the strongest possible hero because it is the thing the product actually
does, and nothing else on a landing page will communicate "air made visible" as
quickly.

**Implementation, in priority order:**

1. **Static WebP poster** — first paint, always. A high-quality render of the model
   at the arc's midpoint. This alone must look finished; everything after it is
   enhancement.
2. **Looping video** — 8–10s WebM with MP4 fallback, silent, `autoplay muted
   playsinline loop`, target under 1.4 MB. Fades in over the poster once buffered.
3. **Live MapLibre instance** — desktop only, only on a fast connection, only when
   `prefers-reduced-motion` is not set. Slow auto-rotate, buildings at reduced
   density, no interaction. If it fails to load within 3s, the video stays.

Under `prefers-reduced-motion: reduce`, the poster is the hero and nothing moves.

```
┌──────────────────────────────────────────────┐
│  aqi.thingsnode              EN · සි · த   ☰ │
│                                              │
│                                              │
│   The air over Sri Lanka,                    │
│   measured and open.                         │
│                                              │
│   Readings from traffic corridors across     │
│   Colombo, alongside every public monitoring │
│   network in the country. The Sri Lanka      │
│   index and the WHO guideline, side by side. │
│                                              │
│   ┌──────────────────┐  ┌─────────────────┐  │
│   │  Open the map  → │  │  How it works   │  │
│   └──────────────────┘  └─────────────────┘  │
│                                              │
│        [ slowly drifting city model,         │
│          exposure columns rising ]           │
│                                              │
│                        ⌄ scroll              │
└──────────────────────────────────────────────┘
```

- **Headline:** `display-l` on mobile, 64/68 weight 800 on desktop. Two lines, always
  broken at the comma.
- **Primary CTA:** "Open the map" → `/app`. Solid `--light-bronze`, `--cornsilk`
  text, `--radius-full`, generous padding. This is the only filled button on the page.
- **Secondary CTA:** "How it works" → smooth-scrolls to section two. Text with a
  `--tea-green` underline, no border.
- **Language switcher** top right, three labels, no flag icons.

#### Section 2 — Two scales, side by side

The one place in the product where the SL/WHO relationship is explained rather than
just shown. Inside the app the two numbers sit together without commentary; here,
where someone has come to understand the project, a plain explanation is appropriate.

A live twin readout component pulled from the real API, showing a real station, next
to short text:

> Sri Lanka's Air Quality Index and the World Health Organization's guidelines are
> two different measures, set for different purposes. They often say different things
> about the same air.
>
> We show both, with their scales named, and leave the reading to you.

Beneath it, the SL band table and the WHO guideline values, as plain tables. No
commentary on which is preferable.

#### Section 3 — The network

- A small static map of station locations, coloured by site class
- Counts by site class
- **Attribution, prominently:** the public networks whose data appears in the
  platform — Central Environmental Authority, National Building Research
  Organisation, Foundation for Environment, Climate and Technology, Overseas School
  of Colombo, and the WAQI project. Named, linked, credited without hedging.

This section is doing political work as much as informational work. Anyone from CEA
or NBRO who lands here should see themselves credited before they see anything else.

**Pre-launch copy.** While `DATA_MODE=demo`, this section states plainly:

> Our own stations are being commissioned. The platform currently runs on simulated
> readings alongside live data from the public networks listed below.

No station counts are claimed for hardware that isn't installed.

#### Section 4 — Built for

Four cards, plain language, no icons-as-decoration:

| | |
|---|---|
| **Schools** | See the day's readings and how they move through school hours. |
| **Parents** | Check the air on a route, at the times a child is on it. |
| **Researchers** | Download calibrated readings with full provenance, or use the API. |
| **Consultants** | Corridor-level monitoring records for environmental assessments. |

#### Section 5 — Open by default

- Apache 2.0 for the code, CC-BY for the data, CC-BY-SA for hardware designs
- Link to the repository
- Link to the API documentation and the methodology page
- A note that readings are published to OpenAQ
- One line on data protection: no individual-level data, no records about children

#### Footer

```
┌──────────────────────────────────────────────┐
│  aqi.thingsnode                              │
│  Air quality data for Sri Lanka.             │
│                                              │
│  PLATFORM        DATA           PROJECT      │
│  Open the map    Open data      About        │
│  Stations        API docs       Repository   │
│  Schools         Methodology    Contact      │
│                                 Licences     │
│                                              │
│  Data sources: CEA · NBRO · FECT · OSC ·     │
│  WAQI                                        │
│                                              │
│  Code Apache 2.0 · Data CC-BY 4.0            │
│  Data protection statement                   │
│                                              │
│  EN · සිංහල · தமிழ்                          │
└──────────────────────────────────────────────┘
```

Footer sits on `--beige`. Hairline top border. Wordmark at `display-m`.

#### Performance budget

The landing page is the first impression and often loads on a phone on mobile data.

| Metric | Target |
|---|---|
| LCP | under 2.0s on 4G |
| Total JS | under 40 KB gzipped |
| Hero poster | under 180 KB WebP |
| Hero video | under 1.4 MB, lazy, never blocking |
| Fonts | Nunito subset, `font-display: swap`, preloaded |

No analytics that block render. No third-party embeds.

### 6.1 Home

Full-bleed 3D map. Content in cards over it, in a scrollable sheet from the bottom.

```
┌─────────────────────────────────────┐
│  aqi.thingsnode      [Demo data ⓘ] │  ← header, transparent over map
│                                     │
│                                     │
│         [ 3D city model with        │
│           exposure columns ]        │
│                                     │
│                                     │
├─────────────────────────────────────┤
│  ═══                                │  ← drag handle
│                                     │
│  NUGEGODA · HIGH LEVEL ROAD         │  label
│  Updated 4 minutes ago              │  data-s, ink-faint
│                                     │
│  ┌─────────────────────────────┐    │
│  │  SRI LANKA AQI │ WHO 24-HOUR │    │  ← twin readout, equal weight
│  │                │             │    │
│  │      34        │  Above      │    │
│  │                │  guideline  │    │
│  │   ● Good       │             │    │
│  │                │  18 µg/m³   │    │
│  │   PM2.5        │  vs 15      │    │
│  └─────────────────────────────┘    │
│                                     │
│  THROUGH THE DAY                    │
│  ┌─────────────────────────────┐    │
│  │   ▁▂▄███▆▄▃▂▃▄▆██▇▅▃▂▁▁     │    │  ← day ribbon
│  │   00   06   12   18   24    │    │
│  │        └─school day─┘       │    │
│  └─────────────────────────────┘    │
│                                     │
│  ┌───────────┬───────────┐          │
│  │ PM2.5     │ PM10      │          │
│  │ 18 µg/m³  │ 31 µg/m³  │          │
│  ├───────────┼───────────┤          │
│  │ Humidity  │ Temp      │          │
│  │ 78%       │ 31°C      │          │
│  └───────────┴───────────┘          │
│                                     │
│  Last 7 days ▸                      │
└─────────────────────────────────────┘
```

#### The twin readout

The most important component in the application. Two columns, one card, a hairline
divider between them, identical type sizes. Neither is styled as primary.

- **Left:** SL AQI value in `display-xl`, band name with a band-colour dot below.
- **Right:** WHO status as "Within guideline" or "Above guideline" in `display-m`,
  with the measured value and the guideline value beneath in `data-m`.

No arrows between them, no "but", no colour-coded warning on the WHO side, no
explanatory sentence. The two facts sit next to each other.

**The one exception:** when PM2.5 exceeds roughly twice the WHO 24-hour guideline
(≥30 µg/m³), a single plain line appears below the card:

> Levels are well above the WHO 24-hour guideline today.

One sentence. No exclamation, no colour, no icon. It does not appear at lower levels.

#### The day ribbon

The time-axis component, in the spirit of the Google Maps busy-times indicator.

```
Horizontal, full card width, 56px tall
X axis: 00:00 → 24:00, ticks at 00 / 06 / 12 / 18 / 24
Bars:   one per hour, height = hourly mean concentration normalised to the
        station's own 30-day maximum
Fill:   AQI band colour for that hour
Now:    current hour drawn at full opacity with a 2px --ink baseline marker;
        all other hours at 0.75 opacity
Overlay: a bracket beneath the axis marking the school day window
         (configurable; default 07:00–14:00), labelled "school day"
Scrub:  dragging across the ribbon shows a tooltip with the hour, the
        concentration, the SL AQI and the WHO status for that hour
Source: rolling 14-day mean by hour-of-day for the "typical day" view;
        toggle to "today" for actual measured values
```

Two modes, toggled by a small segmented control on the card:
- **Typical day** — 14-day average by hour. Shows the pattern.
- **Today** — actual measured values so far, with remaining hours drawn at 0.3
  opacity from the typical-day profile.

No text asserting when the peak is. The shape shows it. If a peak callout is
displayed, it is generated from that station's own data and labelled
"based on the last 14 days at this station".

### 6.2 Map (full screen)

- Search / jump to location
- Filter chips: `All stations` · `Our stations` · `Public feeds` · `Traffic corridors` · `Schools`
- Index selector: `SL AQI` · `WHO` · `US AQI` — changes column colouring
- Window selector: `24h` · `7d` · `30d` — changes column heights
- Legend, bottom left, collapsible: six band swatches with names and ranges
- Tapping a column opens the station sheet

### 6.3 Station detail

- Station header: name, site class, operator, coordinates in `data-s`
- Twin readout, as on Home
- Day ribbon
- Charts: 24h / 7d / 30d / 12mo. Line for concentration, WHO guideline drawn as a
  horizontal reference line in `--ink-faint`, dashed, labelled
- All measured parameters. Parameters not measured at this station render as
  "Not measured" in `--ink-faint` — never as zero, never omitted silently
- **Provenance panel:** source, source name, calibration state, confidence, last
  co-location date, aggregation window
- Download CSV for the visible range

### 6.4 School view

- Register a school: name, location, start and end time, nearest stations
- Daily summary for that school's location and hours
- Day ribbon with the school's own hours as the bracket
- Exposure across the last 30 school days, as a small multiples grid
- **Printable daily notice** — one page, three languages, showing both indices and
  the day ribbon. Designed to be pinned on a noticeboard or sent to parents

### 6.5 Open data

- Station catalogue, browsable and filterable
- Bulk download, CSV and JSON
- API documentation
- **Methodology page** — index formulas, calibration approach, correction factors,
  known limitations, and the note that the SL AQI relationship is verified only
  across the observed range. Publishing limitations openly is a credibility asset

### 6.6 Empty, loading and error states

| State | Treatment |
|---|---|
| Map loading | Cornsilk field, wordmark centred, no spinner |
| Station offline | Column renders at 30% opacity, dashed cap, "Last reading 3 days ago" |
| No data for range | "No readings for this period." + a control to widen the range |
| Feed unreachable | Card stays, shows last known value with its timestamp, plus "Live updates paused" |
| Search no result | "No stations found near [query]." + "Show all stations" |

Errors state what happened and what to do. They do not apologise and they are not vague.

### 6.7 Desktop layout

The mobile design is primary, but schools, researchers and compliance users work on
desktop. Above 1024px the layout changes shape rather than simply widening.

```
┌────┬──────────────────────────────────────────────────────────┐
│    │  ┌─ location selector ─┐          ┌─ index selector ─┐   │
│ ▣  │                                                          │
│    │                                                          │
│ ◫  │              [ 3D city model, full bleed ]               │
│    │                                                          │
│ ≋  │                                                          │
│    │                                                          │
│ ⬡  ├──────────────┬──────────────┬────────────────────────────┤
│    │ Twin readout │ Day ribbon   │  All parameters            │
│    │              │              │  ┌──────────────────────┐  │
│ ⚙  │   34  │Above │ ▁▂▄███▆▄▂▁   │  │ PM2.5  18 µg/m³  ▮▮▮▯│  │
│ ◔  │ Good  │15→18 │ 00  12   24  │  │ PM10   31 µg/m³  ▮▮▯▯│  │
└────┴──────────────┴──────────────┴────────────────────────────┘
```

- **Left icon rail**, 64px, `--papaya-whip`, fixed: Home · Map · Stations · Schools ·
  Open data, with settings and language at the foot. Active item gets an `--ink`
  filled circle. Labels appear on hover as a tooltip, never as permanent text.
- **Map occupies the upper two-thirds**, full bleed behind the rail's right edge.
- **Card row along the bottom**, three columns: twin readout, day ribbon, parameter
  list. Cards keep the same components as mobile — no separate desktop variants.
- **1440px+**: a fourth column appears for the station list, sorted by exposure.

#### Parameter bars

Adopted from the reference dashboards, with one change. Pollutant levels render as a
**segmented tick bar** rather than a continuous fill — roughly 40 discrete ticks,
filled from the left in the current AQI band colour, unfilled ticks in `--hairline`.
Discrete ticks read as measurement; a smooth gradient bar reads as a progress
indicator, which is the wrong metaphor for a concentration.

A thin `--ink` marker sits on the bar at the WHO guideline position, so the guideline
is visible on every parameter without a sentence explaining it.

Parameters not measured at this station show the bar as empty with "Not measured" in
`--ink-faint`.

### 6.8 Working with the reference images

`ui-references/` holds collected dashboard and app screenshots. Treat them as
**structural** references, not stylistic ones.

**Take from them:**
- Card-per-metric grids and the left icon rail for desktop
- Segmented tick bars for pollutant levels
- Time-axis treatments with a highlighted current hour
- The pale 3D city model as a visual object

**Do not take from them:**
- Frosted glass and heavy transparency — this design uses solid warm cards
- Cool grey and blue palettes — we use the warm platform palette throughout
- Painting air quality onto building volumes — colour belongs to the air above them
- Smiley faces, emoji and mascot illustrations
- Multicoloured icon sets — icons are single-weight line icons in `--ink-muted`

---

## 7. Backend

### 7.1 Architecture

```
┌──────────────────┐        ┌──────────────────────┐
│ Station          │        │ Simulation Service   │
│ Simulator        │        │ (same MQTT contract) │
│ (MVP)            │        │                      │
└────────┬─────────┘        └──────────┬───────────┘
         │  MQTT                       │
         └──────────────┬──────────────┘
                        ▼
         ┌──────────────────────────────┐
         │  ThingsBoard CE              │
         │  · device registry           │
         │  · telemetry ingest          │
         │  · alarms                    │
         │  · WS telemetry API          │
         └───────┬──────────────┬───────┘
                 │              │
        WS subscribe        REST/queue
                 │              │
                 ▼              ▼
         ┌──────────────────────────────┐      ┌───────────────────┐
         │  API Gateway (FastAPI)       │◄─────┤ Public feed       │
         │  · TB WS client (single)     │      │ ingestors         │
         │  · fan-out WS to browsers    │      │ CEA / NBRO /      │
         │  · REST for history          │      │ WAQI / aqi.in /   │
         │  · tenancy & auth            │      │ Met Dept          │
         └───────┬──────────────┬───────┘      └───────────────────┘
                 │              │
                 │              ▼
                 │      ┌──────────────────┐
                 │      │ TimescaleDB      │
                 │      │ canonical        │
                 │      │ readings +       │
                 │      │ provenance       │
                 │      └────────┬─────────┘
                 │               │
                 │      ┌────────▼─────────┐
                 │      │ Python services  │
                 │      │ · calibration    │
                 │      │ · aqi-core       │
                 │      │ · insights       │
                 │      │ · forecast       │
                 │      └──────────────────┘
                 ▼
         ┌──────────────────────────────┐
         │  Web app (React PWA)         │
         │  WS for live, REST for rest  │
         └──────────────────────────────┘
```

### 7.2 Architectural rules

1. **The browser never connects to ThingsBoard directly.** The API gateway holds a
   single TB WebSocket subscription and fans out to browser clients over our own WS.
   This keeps TB credentials server-side, keeps tenancy in our layer, and means we
   can merge our own stations with public feeds in a single stream.
2. **ThingsBoard is the device and telemetry layer only.** No index maths, no
   calibration, no insight detection in rule chains.
3. **`aqi-core` is the single source of truth** for all index calculation. Backend,
   simulator and tests import it. Never reimplemented in the frontend.
4. **Every reading carries provenance.** No exceptions, including simulated.
5. **Tenancy lives in our app layer**, not in ThingsBoard customers.

### 7.3 Simulation service

A standalone Python service publishing over MQTT with the same contract a real
station will use. Swapping to hardware is a config change.

#### Signal model

```
value(t) = baseline(season)
         × diurnal(hour_of_day, site_class)
         × weekday(day_of_week, is_poya)
         × washout(recent_precipitation)
         × site_offset(site_class)
         + noise(σ)
```

| Component | Behaviour |
|---|---|
| `baseline` | Seeded from the CEA reference distribution: SW monsoon mean ≈ 15.9 µg/m³ PM2.5, range 10–28. NE monsoon (Oct–Dec) elevated with multi-day episodes |
| `diurnal` | Two-peak profile, morning and early afternoon, with an overnight minimum. Amplitude scales with site class |
| `weekday` | Weekday > Saturday > Sunday and Poya days |
| `washout` | A precipitation event reduces PM 40–60% for 6–12h, then rebounds |
| `site_offset` | `TRAFFIC_CORRIDOR` 1.4–1.8× `BACKGROUND`; `SCHOOL` follows corridor behaviour during school hours only |
| `noise` | Gaussian, σ ≈ 12% of value |

#### RH coupling

The simulator emits a plausible **raw** value inflated by humidity, and the pipeline
applies the correction. This exercises the calibration path in the MVP rather than
leaving it untested until hardware arrives.

#### Fault injection

The simulator must produce realistic failures, because a demo that never fails hides
real bugs:

- Random dropouts (station offline for 10 min – 6 h)
- A stuck sensor (identical value repeated)
- A drifting unit (slow upward bias over days)
- Out-of-range values that the pipeline must reject

#### Configuration

```yaml
DATA_MODE: demo               # demo | live | hybrid
SIMULATION_SEED: 42           # reproducible demos
SIMULATION_SPEED: 1           # >1 to accelerate for showing seasonal features
SIMULATION_START: 2026-08-01
DEMO_BADGE_VISIBLE: true
FAULT_INJECTION: true
```

`hybrid` mode runs real stations where available and simulates the rest, which is the
mode used through the phased rollout.

### 7.4 MQTT contract

Topic: `v1/devices/me/telemetry` (ThingsBoard default)

```json
{
  "ts": 1785209400000,
  "values": {
    "pm1": 7.25,
    "pm2_5_raw": 13.8,
    "pm10_raw": 24.1,
    "no2": null,
    "temperature": 30.92,
    "humidity": 78.46,
    "pressure": 1007.2,
    "wind_speed": 2.1,
    "wind_direction": 215,
    "precipitation": 0.0,
    "battery_v": 12.6,
    "rssi": -71,
    "firmware": "1.0.0",
    "source_type": "SIMULATED"
  }
}
```

Note `pm2_5_raw` — raw values are transmitted, corrected values are computed
server-side and stored alongside. The raw value is never discarded.

### 7.5 Live data path

```
Station/Simulator ──MQTT──▶ ThingsBoard
                                │
                      TB WS subscription (one, server-side)
                                │
                                ▼
                        API Gateway
                    ┌───────────┴───────────┐
                    │  · apply calibration   │
                    │  · compute indices     │
                    │  · attach provenance   │
                    │  · write to Timescale  │
                    └───────────┬───────────┘
                                │
                    fan-out over our WS
                                │
                                ▼
                         Browser clients
```

#### Our WebSocket protocol

```jsonc
// client → server
{ "action": "subscribe", "stations": ["uuid", "uuid"], "index": "sl_aqi" }
{ "action": "subscribe", "bbox": [79.7, 6.8, 80.0, 7.0] }
{ "action": "unsubscribe", "stations": ["uuid"] }

// server → client
{
  "type": "reading",
  "station_id": "uuid",
  "ts": 1785209400000,
  "measurements": { "pm2_5": 18.0, "pm10": 31.0, "...": null },
  "indices": {
    "sl_aqi":  { "value": 36, "band": "Good", "dominant": "pm2_5" },
    "us_aqi":  { "value": 64, "band": "Moderate", "dominant": "pm2_5" },
    "who_24h": { "status": "ABOVE", "value": 18.0, "guideline": 15.0 }
  },
  "provenance": {
    "source_type": "SIMULATED",
    "calibration_state": "RH_CORRECTED",
    "confidence": "HIGH"
  }
}

{ "type": "station_offline", "station_id": "uuid", "last_seen": 1785200000000 }
{ "type": "heartbeat", "ts": 1785209460000 }
```

Reconnect with exponential backoff, capped at 30 s. On reconnect the client requests
a catch-up snapshot over REST rather than replaying the stream.

### 7.6 Public feed ingestors

Scheduled workers, each writing into the same canonical schema.

| Ingestor | Method | Cadence | Notes |
|---|---|---|---|
| CEA | REST JSON | Hourly poll, daily aggregates | Gases and wind arrive null |
| NBRO | PDF parse + web | Daily | Bulletin includes a 24h forecast worth capturing |
| WAQI / aqicn | REST, token | Hourly | ~26 LK locations; includes FECT feeds |
| aqi.in | Scrape / REST | Hourly | Overseas School of Colombo |
| Met Department | Scrape | Daily | Wind and rainfall, needed for dispersion context |

Each ingestor is idempotent, records fetch success/failure, and never overwrites a
reading from a higher-confidence source.

### 7.7 Station placement registry

Stations are configuration, not code. A seed file drives both the simulator and the
production registry.

```yaml
stations:
  - id: sta-hlr-nugegoda
    name: "Nugegoda – High Level Road"
    name_si: "නුගේගොඩ – හයි ලෙවල් පාර"
    name_ta: "நுகேகொடை – ஹை லெவல் வீதி"
    lat: 6.8649
    lng: 79.8997
    site_class: TRAFFIC_CORRIDOR
    corridor: "High Level Road"
    district: Colombo
    operator: ThingsNode
    parameters: [pm1, pm2_5, pm10, no2, temperature, humidity, wind]
    nearby_schools: [sch-nugegoda-mv]
    status: PLANNED
```

**Phase 1 allocation (15 units)** — placement determines whether the network is
scientifically interpretable, so this is fixed before procurement:

| Count | Site class | Purpose |
|---|---|---|
| 2 | `REFERENCE_COLOCATED` | Calibration anchor at a CEA/NBRO reference site |
| 1 | `BACKGROUND` | Clean upwind control |
| 5 | `TRAFFIC_CORRIDOR` | Kandy Rd, Negombo Rd, Galle Rd, High Level Rd, Baseline Rd |
| 4 | `SCHOOL` | Paired 200–400 m from a corridor unit, to isolate the school-gate signal |
| 2 | `INDUSTRIAL` | Port / industrial zone |
| 1 | `COASTAL` | Sea-breeze and inflow signal |

### 7.8 REST API

```
GET  /api/v1/stations
GET  /api/v1/stations/{id}
GET  /api/v1/stations/{id}/readings?from=&to=&aggregation=hour|day
GET  /api/v1/stations/{id}/diurnal?days=14        → day ribbon data
GET  /api/v1/readings/latest?bbox=&site_class=
GET  /api/v1/readings/snapshot?stations=          → WS reconnect catch-up
GET  /api/v1/exposure?station_id=&window=7d       → column heights
GET  /api/v1/schools/{id}/summary
GET  /api/v1/export?stations=&from=&to=&format=csv|json
GET  /api/v1/meta/bands                           → SL/US/WHO band definitions
```

Read endpoints are unauthenticated, rate-limited, CORS-open. We want people building
on this.

### 7.9 Stack

| Layer | Choice |
|---|---|
| IoT core | ThingsBoard CE (Apache 2.0) |
| Time series | TimescaleDB on PostgreSQL |
| API | FastAPI (Python 3.12) |
| Realtime | WebSocket via FastAPI, Redis pub/sub for multi-worker fan-out |
| Workers | Celery or APScheduler for ingestors |
| Frontend | React + Vite, TypeScript |
| Map | MapLibre GL + OpenFreeMap tiles |
| Charts | Custom SVG/Canvas — the day ribbon and columns are bespoke, not a chart library |
| State | TanStack Query for REST, a thin WS store for live |
| i18n | `en` / `si` / `ta`, JSON message catalogues |
| Deploy | Docker Compose for MVP, Kubernetes later |

### 7.10 URL structure and deployment

**Recommendation: path-based, single origin.**

```
aqi.thingsnode.cc/            → landing page (static)
aqi.thingsnode.cc/app         → the application (React PWA)
aqi.thingsnode.cc/api/v1      → FastAPI
aqi.thingsnode.cc/api/v1/ws   → WebSocket
aqi.thingsnode.cc/data        → open data browser
aqi.thingsnode.cc/docs        → API documentation and methodology
```

`app.aqi.thingsnode.cc` is registered and 301-redirects to `/app`, so links written
either way keep working.

**Why path-based rather than a subdomain.** `aqi.thingsnode.cc` is already a
third-level name, so `app.aqi.thingsnode.cc` is a fourth-level one — and a wildcard
certificate for `*.thingsnode.cc` does not cover it, since wildcards match a single
label only. You would need a second certificate for `*.aqi.thingsnode.cc`. Beyond
that, a single origin means:

- No CORS configuration between the app and its own API
- Shared storage, so a language preference set on the landing page carries into the app
- A single service worker scope, which matters because the app is a PWA — scope
  `/app/` with `start_url: /app`, and the landing page stays outside it and
  uncached
- One TLS certificate, one CDN distribution, one deployment target

The cost is that the landing page and the app share a domain and therefore a cache
configuration, which is easily handled with per-path cache headers.

#### Routing

A reverse proxy (Caddy or nginx) in front of everything:

| Path | Upstream | Cache |
|---|---|---|
| `/` | static site build | 1h, revalidate |
| `/assets/*` | static | 1y, immutable |
| `/app*` | SPA index fallback | no-cache on index, 1y on hashed assets |
| `/api/*` | FastAPI | no-store |
| `/api/v1/ws` | FastAPI, upgrade | — |

#### Build targets

```
/apps
  /site     landing page — static, minimal JS, its own build
  /web      the application — React + Vite PWA
  /api      FastAPI
```

The landing page is a separate build so it never inherits the application's bundle.
A plain Vite static build is sufficient; Astro is worth considering only if the
project later grows content pages that want collections and MDX.

#### A note on the domain

`.cc` is fine technically and works everywhere. For a Sri Lankan public health
project seeking government partnership and institutional funding, a `.lk` or
`.org.lk` name will eventually carry more weight with ministries and donors than a
Cocos Islands ccTLD. Not a blocker and not urgent — but worth securing the name early
if it is likely to be wanted later, and running it as a redirect until then.

---

## 8. Repository layout

```
/apps
  /site                 landing page — static, minimal JS, separate build
    /src
      /sections         hero, two-scales, network, built-for, open
      /assets           hero poster + video
  /web                  React PWA — the application, served at /app
    /src
      /components
        /map            MapLibre wrapper, column layer, air layer
        /readout        twin readout
        /ribbon         day ribbon
        /cards
      /pages
      /styles           tokens.css, type.css
      /i18n             en.json, si.json, ta.json
  /api                  FastAPI gateway, REST + WS
/services
  /simulator            station simulator
  /ingestors            cea/, nbro/, waqi/, aqiin/, met/
  /calibration          RH correction, drift detection
  /insights             detector library
  /forecast
/packages
  /aqi-core             SL / US / WHO index library — single source of truth
  /schemas              shared canonical types
/config
  stations.yaml         station registry, drives simulator and production
/docs
  /methodology          calibration, corrections, known limitations
  /hardware             BOM, siting guide
  /api                  OpenAPI spec
/infra
  docker-compose.yml
```

---

## 9. Build sequence

Frontend and backend developed together, so the UI is always running against a real
data path.

| Step | Deliverable | Depends on |
|---|---|---|
| 1 | `aqi-core` with SL/US/WHO functions + full test suite | — |
| 2 | `stations.yaml` seed with all 15 planned stations | — |
| 3 | Simulation service → MQTT → ThingsBoard, telemetry visible in TB | 1, 2 |
| 4 | TimescaleDB schema + API gateway TB WS subscription + fan-out | 3 |
| 5 | Design tokens, type scale, wordmark | — |
| 6 | Map with 3D buildings and recoloured style | 5 |
| 7 | Exposure Column layer, live over WS | 4, 6 |
| 8 | Twin readout + day ribbon | 4, 5 |
| 9 | Home screen assembled | 7, 8 |
| 10 | CEA + NBRO ingestors, public stations on the map | 4 |
| 11 | Station detail, provenance panel, CSV export | 10 |
| 12 | School view and printable notice | 9 |
| 13 | Open data pages, API docs, methodology page | 11 |
| 14 | Landing page — hero poster, sections, footer, routing | 8, 9 |
| 15 | Hero video render from the live model; live-map enhancement | 14 |
| 16 | i18n for `si` and `ta`, type scale verified in all scripts | 9, 14 |
| 17 | Fault injection, offline and error states verified | 3, 9 |

Steps 1–9 constitute a demonstrable MVP. Step 14 makes it presentable to anyone who
isn't in the room — do it before the first funder demo, since the hero render can be
produced straight from the working map in step 7.

---

## 10. Demo mode

For the period before stations are commissioned.

- All readings carry `source_type: SIMULATED` in the provenance block
- Header shows a small chip: **Demo data** — dismissible, with a tooltip explaining
  that stations are being commissioned and figures are simulated from historical
  distributions
- Simulated station columns use the same dashed-cap treatment as public feeds
- No other visual difference. Layouts, colours, charts and interactions are final
- Driven entirely by `DATA_MODE`; going live is a config change

---

## 11. Quality floor

Not negotiable, and not announced in the interface.

- Responsive from 360px to 2560px
- Visible keyboard focus on every interactive element, `--light-bronze` 2px outline
  with 2px offset
- `prefers-reduced-motion` respected throughout
- Colour never the sole carrier of meaning
- Text contrast 4.5:1 minimum, verified in all three scripts
- Map has a 2D fallback and a low-bandwidth mode
- All three languages render correctly, including Sinhala line-height
- Screen-reader labels on columns: "Nugegoda High Level Road, Sri Lanka AQI 34, Good,
  PM2.5 18 micrograms per cubic metre, above the WHO 24-hour guideline of 15"

---

## 12. Copy principles

- Name things by what people recognise. "Stations", not "devices" or "nodes".
- Always name the scale. Never a bare number.
- State facts, not conclusions. "18 µg/m³ vs 15" rather than "unhealthy".
- One plain sentence at high levels, and only then.
- Active voice on controls: "Download readings", not "Export data".
- The same word throughout a flow. If the button says "Register school", the
  confirmation says "School registered".
- Never apologise in an error. Say what happened and what to do next.

---

## Appendix — Token reference

```css
:root {
  /* Platform */
  --cornsilk: #FEFAE0;
  --papaya-whip: #FAEDCD;
  --beige: #E9EDC9;
  --tea-green: #CCD5AE;
  --light-bronze: #D4A373;

  /* Derived neutrals */
  --ink: #3A342B;
  --ink-muted: #7A7263;
  --ink-faint: #A99F8C;
  --hairline: #E4DCC4;

  /* AQI scale — data only */
  --aqi-good: #8EBD96;
  --aqi-moderate: #D8DC82;
  --aqi-slightly-unhealthy: #FED665;
  --aqi-unhealthy: #FA9D45;
  --aqi-very-unhealthy: #E76E6B;
  --aqi-hazardous: #9A5D7C;

  /* Type */
  --font-primary: 'Nunito', system-ui, sans-serif;
  --font-mono: ui-monospace, 'SF Mono', 'Cascadia Mono', Menlo, monospace;
  --font-si: 'Noto Sans Sinhala', sans-serif;
  --font-ta: 'Noto Sans Tamil', sans-serif;

  /* Space */
  --space-1: 4px;  --space-2: 8px;  --space-3: 12px; --space-4: 16px;
  --space-5: 24px; --space-6: 32px; --space-7: 48px; --space-8: 64px;

  /* Radius */
  --radius-s: 8px; --radius-m: 14px; --radius-l: 22px; --radius-full: 999px;

  /* Elevation */
  --elev-1: 0 1px 2px rgba(90,74,48,0.06), 0 2px 8px rgba(90,74,48,0.05);
  --elev-2: 0 2px 4px rgba(90,74,48,0.07), 0 8px 24px rgba(90,74,48,0.08);
  --elev-3: 0 4px 8px rgba(90,74,48,0.08), 0 16px 48px rgba(90,74,48,0.10);
}
```

### Band mapping

| SL AQI | Band | Token |
|---|---|---|
| 0–50 | Good | `--aqi-good` |
| 51–100 | Moderate | `--aqi-moderate` |
| 101–150 | Slightly Unhealthy | `--aqi-slightly-unhealthy` |
| 151–200 | Unhealthy | `--aqi-unhealthy` |
| 201–300 | Very Unhealthy | `--aqi-very-unhealthy` |
| 301–500 | Hazardous | `--aqi-hazardous` |
