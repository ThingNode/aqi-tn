# Prompt 1 — Claude Design

> Paste this into Claude Design with `project-plan/` and `ui-references/` available.

---

I'm building **aqi.thingsnode**, a public air quality platform for Sri Lanka. I need
you to design it.

Read both documents. `Product-Spec.md` covers
strategy and data; `aqi.thingsnode-Application-Spec.md` covers the design system,
screens and backend. The design system in section 4 of that second document is
settled: palette, Nunito type scale, spacing, elevation, motion. Work inside it
rather than proposing alternatives.

I have included UI ideation screenshots. Section 6.8 of the spec says
exactly what to take from them and what to leave — read that before you look at them.
They are structural references, not stylistic ones.

Check what generation and design tooling is available to you in this environment
before you start, and use whatever fits.

## What this is

A tool for a school administrator, on a phone, with thirty seconds. It shows what the
air is doing here and now, and how it moves through the day. Secondary users are
parents, researchers and compliance consultants.

It is a public health instrument used by institutions. It should feel calm, credible
and precise — not playful, not alarming, not a consumer weather app.

## The concept

**A physical model of the city, with the air made visible above it.**

The map is a pale architectural study model — buildings extruded in warm off-white.
Air quality is never painted onto the buildings. It sits above them, as translucent
vertical columns rising from each station and, where the device can handle it, as a
faint volumetric layer at breathing height. The interface cards are warm, solid and
physically shadowed, like instrument readouts laid on the same desk as the model.

## The signature element

**The Exposure Column.** Colour is the current AQI band. Height is cumulative
exposure over the selected window. A thin ring marks where the WHO 24-hour guideline
sits on that column. So a corridor can read green today and still stand visibly tall.

This is the one bold thing. Everything around it stays quiet. Spec is in section 5.3.

## The hardest component to get right

**The twin readout.** Sri Lanka's AQI and the WHO guideline comparison, side by side,
in one card, with a hairline between them and identical type sizes. Neither is styled
as primary. No arrows, no "but", no warning colour on the WHO side, no explanatory
sentence.

The two facts sit next to each other and the user draws their own conclusion. Getting
this to feel neutral rather than accusatory is the whole editorial stance of the
product, and it is easy to get wrong by making one side look more important. Spec is
in section 6.1.

## Second component: the day ribbon

A time axis across the day, in the spirit of the Google Maps busy-times indicator.
Hourly bars, coloured by band, current hour marked, with a bracket beneath showing
the school day. Two modes: "typical day" from a 14-day average, and "today". Never
asserts when the peak is — the shape shows it.

## Deliver

1. **A short design plan first**, before any screens. Confirm the direction, name the
   one aesthetic risk you're taking and why, and flag anything in the spec you think
   is wrong. I'd rather argue at this stage than after the screens exist.

2. **Then the screens.** Start with the landing page, then the app mobile-first:

   **Landing page** (section 6.0) — desktop and mobile. The hero is the product's own
   city model with exposure columns rising, not a stock photograph. I need a
   finished-looking static poster frame as the primary deliverable; the video loop
   and the live-map version are enhancements on top of it. Then the scroll sections
   and footer.

   **The application:**
   - Home, in three states: good conditions, moderate, and the high-level case where
     the single plain sentence appears
   - Map, full screen, with filters and legend
   - Station detail, including the provenance panel
   - School view and the printable daily notice
   - Desktop home at 1440px, using the left icon rail layout in section 6.7

3. **Component sheet:** twin readout, day ribbon, exposure column at four heights,
   parameter tick bar, band chips, cards, buttons, inputs, the demo chip.

4. **The wordmark**, text only, Nunito.

5. **Empty, loading, offline and error states** — section 6.6. Please treat these as
   real design work rather than an afterthought; a station going offline is a normal
   Tuesday for this product.

6. **A token file** I can hand straight to the build, matching the appendix.

## Constraints

- Nunito throughout, weight and size for hierarchy, no second display face
- Tabular figures on every number that updates or aligns
- Warm platform palette for all chrome; the six AQI colours for data only, never for
  buttons or navigation
- Band colour never carries meaning alone — always paired with the band name
- No glassmorphism, no frosted panels, no backdrop blur
- No emoji, no smiley faces, no mascots
- Verify the type scale in Sinhala and Tamil, not just English
- 360px to 2560px, visible keyboard focus, `prefers-reduced-motion` honoured
- Contrast 4.5:1 on text, checked in all three scripts

## What I'm worried about

The warm cream-and-bronze palette plus a rounded typeface could easily drift soft and
generic. The 3D model and the exposure columns are what keep it modern and serious.
If a screen starts feeling like a wellness app, the columns aren't doing enough work
and the type is probably too light.

The landing page is the other risk. It has one filled button on the whole page and it
should feel restrained — a public institution's site, not a startup launch. If it
starts accumulating gradient badges, testimonial slots or feature grids with icons,
something has gone wrong.

Critique your own screens before you show them, and tell me what you'd cut.
