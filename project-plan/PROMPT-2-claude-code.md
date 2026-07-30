# Prompt 2 — Claude Code

> Paste this into Claude Code once the design output exists.
> Assumes `project-plan/`, `ui-references/` and the design output are in the repo.

---

Build the **aqi.thingsnode** MVP — a public air quality platform for Sri Lanka.

Read `project-plan/` first. `aqi.thingsnode-Application-Spec.md` is the build spec:
section 7 is the backend architecture, section 8 the repo layout, section 9 the build
sequence. `BreathSafe-LK-Product-Spec.md` gives the strategy and the data source
detail. Follow the design output for all visual decisions — do not reinterpret the
design system.

Frontend and backend are one piece of work. The UI must always run against a real
data path, never against mocked JSON.

## Architectural rules — these are not negotiable

1. **`packages/aqi-core` is the single source of truth** for all index calculation.
   Backend, simulator and tests import it. It is never reimplemented in the frontend.
2. **The browser never talks to ThingsBoard.** The API gateway holds one server-side
   TB WebSocket subscription and fans out to browser clients over our own WS. TB
   credentials stay server-side.
3. **ThingsBoard is the device and telemetry layer only.** No index maths, no
   calibration, no insight detection in rule chains.
4. **Every reading carries a provenance block.** No exceptions, including simulated
   readings. Provenance is not optional metadata; it is part of the record.
5. **Raw values are never discarded.** Stations transmit raw PM; correction happens
   server-side and both are stored.
6. **Tenancy lives in our app layer**, not in ThingsBoard customers.

## Build in this order

Each step should run and be verifiable before you move on.

**1. `packages/aqi-core`**
SL AQI, US AQI and WHO status functions with a full test suite. The Sri Lanka
formulas are in section 2 of the spec and in the appendix — they were derived from
real CEA data, so include those observed value pairs as test fixtures. Include a
guard noting the SL relationship is verified only across SL AQI 20–56.

**2. `config/stations.yaml`**
All 15 planned stations with the Phase 1 site-class allocation from section 7.7. This
one file drives both the simulator and the production registry.

**3. Simulation service → MQTT → ThingsBoard**
Section 7.3. The signal model matters: seasonal baseline, two-peak diurnal profile,
weekday and Poya variation, rain washout, site-class offset, RH-inflated raw values.
Include the fault injection — dropouts, a stuck sensor, a drifting unit,
out-of-range values. A demo that never fails hides real bugs. Verify telemetry
appears in the ThingsBoard UI before moving on.

**4. TimescaleDB + API gateway**
Canonical schema with provenance, the TB WS subscription, WS fan-out to browsers,
REST for history. Protocol is in section 7.5.

**5. Design tokens and the type scale**
From the design output. Nunito, tabular figures on every aligning number.

**6. The map**
MapLibre GL, OpenFreeMap, extruded buildings, recoloured to the palette. The base
implementation is in section 5.1 — use it as given. Buildings stay neutral; AQI
colour never touches them.

**7. Exposure Column layer**
Section 5.3, driven live over WebSocket. Colour is band, height is cumulative
exposure, ring marks the WHO guideline. Build the 2D fallback at the same time, not
later.

**8. Twin readout and day ribbon**
The two components that carry the product. Both are bespoke SVG/Canvas — do not
reach for a charting library.

**9. Home screen assembled**

That is the demonstrable MVP. Then: CEA and NBRO ingestors, station detail with the
provenance panel, school view, open data pages, the landing page, `si` and `ta`
translations, and a pass over the offline and error states.

**On the landing page** (section 6.0, routing in 7.10): it is a separate static
build at `apps/site` and must never import from the application bundle. Budget is
under 40 KB of JS. Build it after step 9, because the hero render can be produced
directly from the working map — position the camera, capture the poster frame and the
video loop from the real model rather than mocking it up.

Routing is path-based on a single origin: `/` landing, `/app` the PWA, `/api/v1` the
API. Register `app.aqi.thingsnode.cc` as a 301 to `/app`. Service worker scope stays
`/app/` so the landing page is never cached by it — getting this wrong means people
see a stale landing page after every deploy.

## Decisions I need you to surface, not guess

- **The exposure column `reference_dose` constant.** It determines what "tall" means.
  Set it from the WHO annual guideline and every Colombo corridor maxes out
  immediately; set it too high and nothing reads as concerning. Use a documented
  fixed value in demo mode, make it configurable, and tell me what you chose.
- **RH correction form.** Start with a documented polynomial on relative humidity.
  It is a placeholder until real co-location data exists — mark it clearly as such in
  the code and on the methodology page.
- Anything in the spec that turns out to be wrong once you are in the code. Say so
  rather than working around it.

## Demo mode

`DATA_MODE=demo` until stations are commissioned. All readings carry
`source_type: SIMULATED`. One dismissible "Demo data" chip in the header. Simulated
stations use the same dashed-cap treatment as public feeds. No other visual
difference — going live is a config change, not a migration.

## Stack

Section 7.9. Monorepo per section 8. Docker Compose for local, ThingsBoard CE,
TimescaleDB, FastAPI, React + Vite + TypeScript, MapLibre GL, Redis for WS fan-out.

## Quality floor

Section 11. Responsive 360–2560px, visible keyboard focus, `prefers-reduced-motion`
honoured, colour never the sole carrier of meaning, screen-reader labels on the
columns, all three languages rendering correctly.

## How I'd like you to work

Commit in working increments and tell me what runs at each step. Write the tests for
`aqi-core` before the implementation — it is the one place a silent error propagates
into every number the product displays.

Everything here will be open-sourced under Apache 2.0, so write it to be read by
someone who wasn't in this conversation. The methodology page in particular should be
honest about what is a placeholder and what is validated.
