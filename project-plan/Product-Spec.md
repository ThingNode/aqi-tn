# Air Quality & Child Health Platform — Product Specification

**Working name:** aqi.thingsnode
**Domain:** aqi.thingsnode.cc
**Version:** 0.1 — MVP specification
**Date:** 29 July 2026
**Status:** Draft for handoff to design & build

---

## 1. One-line summary

An open-source air quality platform for Sri Lanka that turns raw PM data from a national network of traffic-corridor stations — plus every existing public feed — into concrete, child-calibrated decisions for schools, parents and clinicians.

---

## 2. The thesis

Sri Lanka's national Air Quality Index is a linear function of particulate concentration:

```
SL_AQI_PM25 = round(2 × PM2.5_µg_m3)     # verified, max error ±1 over 30 CEA records
SL_AQI_PM10 = round(1 × PM10_µg_m3)      # verified, exact over 30 CEA records
```

Verified against the aq.cea.lk daily API payload and cross-checked against the NBRO
"Ambient Air Quality Status in Major Urban Areas" daily bulletin (22/07/2026).

### SL AQI bands

| Band | SL AQI | PM2.5 (µg/m³) | PM10 (µg/m³) |
|---|---|---|---|
| Good | 0–50 | 0–25 | 0–50 |
| Moderate | 51–100 | 25–50 | 51–100 |
| Slightly Unhealthy | 101–150 | 50–75 | 101–150 |
| Unhealthy | 151–200 | 75–100 | 151–200 |
| Very Unhealthy | 201–300 | 100–150 | 201–300 |
| Hazardous | 301–500 | 150–250 | 301–500 |

### The gap

The WHO 24-hour PM2.5 guideline is **15 µg/m³**. Sri Lanka's "Good" band extends to
**25 µg/m³** — 1.7× the WHO limit. WHO's annual guideline is 5 µg/m³.

Analysis of 30 consecutive days of real CEA data (location 3, 29 Jun – 28 Jul 2026),
during the *cleanest* part of the year:

| Metric | Value |
|---|---|
| Mean PM2.5 | 15.9 µg/m³ |
| Days above WHO 24h guideline | 17 / 30 (57%) |
| Days labelled "Good" by SL AQI | 28 / 30 (93%) |
| Mean vs WHO annual guideline | 3.2× |

**A Colombo school checking the national index sees "Good" on 93% of days while
children exceed WHO guidance on 57% of them.**

This is the product. Not sensor density — interpretation. It positions us as
complementary to CEA/NBRO rather than competing with them, which is also the correct
political posture for eventual data-sharing agreements.

### Design consequence

Every displayed number must carry its scale label. The same Kegalle station reads
**48 (SL AQI)** in the NBRO bulletin and **97 (US AQI)** on waqi.info. Unlabelled
numbers reproduce exactly the confusion the product exists to remove.

Default display scale: **SL AQI**, with a **WHO Guideline Status** indicator always
shown alongside it. US AQI available as a user preference for international schools
and hotels.

---

## 3. Users and jobs to be done

| User | Job | Decision they need to make |
|---|---|---|
| **School administrator** | Decide today's outdoor activity | Run PE outside / move indoors / shorten session |
| **Parent** | Protect a specific child | Mask today? Change commute window? Which route? |
| **Parent of asthmatic child** | Anticipate symptom triggers | Pre-medicate? Keep child home? |
| **Paediatrician / MOH** | Link symptoms to exposure | What was this child's 7-day exposure on their route? |
| **Researcher / university** | Access clean, documented data | Download calibrated series with provenance |
| **CEA / NBRO / policy** | See corridor-level detail | Which corridors exceed, and when? |
| **Construction / EIA consultant** *(revenue)* | Demonstrate compliance | Generate a defensible monitoring report |
| **Hotel** *(phase 3)* | Guest comfort & marketing | Indoor/outdoor air status, certification |

**Primary MVP user: the school administrator.** Everything else is secondary until
that one job is done well.

---

## 4. Scope

### In scope for MVP

- Unified ingest of own stations + CEA + NBRO + aqicn/FECT + aqi.in
- Simulated station data seeded from real distributions (`DATA_MODE=demo`)
- Map + station detail + historical charts
- SL AQI / US AQI / WHO status, always labelled
- **School Advisory**: a single daily yes/no/modify recommendation
- **Commute Window**: safest departure times for a given route
- **Haze Season Watch**: multi-day forecast with an action plan
- Child Exposure Score (cumulative, not instantaneous)
- Public read-only API + open data download
- Mobile-first responsive web app

### Explicitly out of scope for MVP

- Real health outcome data (design assumes zero; any linkage is upside)
- Individual-level anything — no child records, no personal health data
- Native mobile apps (PWA only)
- Hotel certification / badge programme
- Indoor air monitoring
- Payment or subscription flows

### Deferred but designed for

- Corridor NO2 (nobody in Sri Lanka publishes this; strong differentiator)
- Retrospective health correlation study with a hospital/university partner
- Construction & EIA compliance reporting module (revenue)

---

## 5. Data architecture

### 5.1 Sources

| Source | Type | Access | Cadence | Notes |
|---|---|---|---|---|
| **Own stations** | Primary | MQTT → ThingsBoard | 1–5 min | 15 units, traffic corridors |
| **aq.cea.lk** | Public | REST JSON | Daily aggregate | PM only; gases all null; wind null |
| **aq.nbro.gov.lk** | Public | Daily PDF + web | Daily | Includes a 24h forecast |
| **aqicn.org / WAQI** | Public | API (token) | Hourly | ~26 LK locations; FECT feeds |
| **aqi.in** | Public | Scrape/API | Hourly | Overseas School of Colombo |
| **Met Department** | Public | Manual/scrape | Daily | Wind, rainfall — needed for dispersion |

**Critical gaps in public data:** no gases (O3/NO2/CO/SO2 all null in CEA payload),
no wind, no precipitation. Our own stations must supply these. NO2 in particular is
the traffic signature pollutant and would be a national first.

### 5.2 Provenance model — mandatory on every reading

Required regardless of simulation, because we blend five sources with different
calibration characteristics.

```
source_type: OWN_SENSOR | PUBLIC_CEA | PUBLIC_NBRO | PUBLIC_WAQI | PUBLIC_AQIIN | SIMULATED
calibration_state: RAW | RH_CORRECTED | REFERENCE_COLOCATED
confidence: HIGH | MEDIUM | LOW
aggregation: INSTANT | HOURLY_MEAN | DAILY_MEAN
```

### 5.3 Canonical reading schema

```jsonc
{
  "reading_id": "uuid",
  "station_id": "uuid",
  "timestamp_utc": "2026-07-28T23:59:59Z",
  "window": { "start": "...", "end": "...", "hours": 24 },

  "measurements": {
    "pm1":   { "value": 7.25,  "unit": "ug/m3" },
    "pm2_5": { "value": 11.04, "unit": "ug/m3" },
    "pm10":  { "value": 20.62, "unit": "ug/m3" },
    "no2":   null,
    "o3":    null,
    "co":    null,
    "so2":   null,
    "co2":   { "value": 405.08, "unit": "ppm" }
  },

  "meteorology": {
    "temperature_c": 30.92,
    "humidity_pct": 78.46,
    "pressure_hpa": 1007.2,
    "wind_speed_ms": null,
    "wind_direction_deg": null,
    "precipitation_mm": null
  },

  "indices": {
    "sl_aqi":  { "value": 22, "band": "Good",     "dominant": "pm2_5" },
    "us_aqi":  { "value": 46, "band": "Good",     "dominant": "pm2_5" },
    "who_24h": { "status": "WITHIN",  "guideline": 15, "ratio": 0.74 }
  },

  "provenance": {
    "source_type": "SIMULATED",
    "source_name": "Simulation Service v1",
    "calibration_state": "RAW",
    "confidence": "HIGH",
    "aggregation": "DAILY_MEAN"
  }
}
```

### 5.4 Station schema

```jsonc
{
  "station_id": "uuid",
  "name": "High Level Road – Nugegoda",
  "name_si": "...", "name_ta": "...",
  "lat": 6.8649, "lng": 79.8997,
  "elevation_m": 12,
  "site_class": "TRAFFIC_CORRIDOR",   // TRAFFIC_CORRIDOR | SCHOOL | BACKGROUND | INDUSTRIAL | COASTAL | REFERENCE_COLOCATED
  "corridor": "High Level Road",
  "district": "Colombo",
  "operator": "ThingsNode",
  "hardware": "AirGradient Open Air (mod)",
  "parameters": ["pm1","pm2_5","pm10","no2","temp","rh","wind"],
  "commissioned_at": "2026-10-01",
  "last_colocation": "2026-09-15",
  "nearby_schools": ["uuid", "uuid"],
  "status": "ACTIVE"
}
```

### 5.5 Index calculation module

Single shared library, used identically by backend and simulator.

```
sl_aqi_pm25(v)  -> round(2 * v)
sl_aqi_pm10(v)  -> round(v)
sl_aqi(record)  -> max of available sub-indices; report dominant pollutant

us_aqi_pm25(v)  -> EPA piecewise-linear breakpoints (2024 revision)
who_status(v)   -> WITHIN (<=15) | EXCEEDS (>15) for 24h mean
                   annual: WITHIN (<=5) | EXCEEDS (>5)
```

---

## 6. Simulation service specification

A standalone Python service that publishes to ThingsBoard over MQTT, identical in
shape to a real station. Swapping to real hardware is a config change, not a
migration.

### Behaviour

Seeded from the real CEA distribution (mean ~15.9 µg/m³ PM2.5, range 10–28 in
SW monsoon), then modulated by:

1. **Diurnal curve** — peaks 07:00–09:00 and 13:00–15:00, per the NBRO bulletin's
   own stated forecast. Overnight minimum ~02:00–05:00.
2. **Site-class offset** — TRAFFIC_CORRIDOR runs 1.4–1.8× BACKGROUND; SCHOOL sites
   inherit corridor behaviour during drop-off/pick-up windows only.
3. **Weekly cycle** — weekday > Saturday > Sunday/Poya.
4. **Seasonal envelope** — SW monsoon (May–Sep) low; NE monsoon haze (Oct–Dec)
   elevated by 2–4× with multi-day episodes.
5. **Rain washout** — precipitation event drops PM 40–60% for 6–12h, then rebounds.
6. **RH coupling** — raw sensor value inflates with RH, so the simulator emits a
   plausible *raw* value and the pipeline applies the correction. This exercises the
   calibration path in the MVP.
7. **Realistic faults** — occasional dropouts, a stuck sensor, a drifting unit. The
   UI must handle these gracefully; a demo that never fails hides real bugs.

### Configuration

```yaml
DATA_MODE: demo            # demo | live | hybrid
SIMULATION_SEED: 42        # reproducible demos
SIMULATION_SPEED: 1x       # accelerate for demonstrating seasonal features
DEMO_BADGE_VISIBLE: true
```

### UI treatment

One small chip in the header: **"Demo data"**, dismissible, with a tooltip stating
that stations are being commissioned and figures are simulated from historical
distributions. Driven entirely by `DATA_MODE`. No other visual difference — layouts,
colours, charts and interactions are final.

Rationale: provenance fields are required anyway to blend five real sources; marking
simulation is one enum value plus one chip. It costs nothing, makes the go-live swap
a config flag, and reads as methodological rigour to a funder rather than as a
disclaimer. Public-health figures that circulate unmarked are a one-way reputational
risk.

---

## 7. Insight engine — detection catalogue

This is the core IP. Each detector is a hypothesis with a defined data requirement,
so they can be validated as real data accumulates.

### Confirmed (already evidenced)

| Insight | Evidence | Output |
|---|---|---|
| **School-run peak** | NBRO bulletin states daily maximum falls 07:00–09:00 and 13:00–15:00 — exactly drop-off and pick-up | "Peak exposure window is 07:15–08:30. Consider arriving before 07:00 or after 08:45." |
| **Transboundary haze season** | CEA documents Oct–Dec NE monsoon haze; back-trajectory analysis attributes to Indian subcontinent | Multi-day advance warning + school action plan |
| **WHO/SL divergence** | 57% of days exceed WHO while 93% read "Good" | Persistent secondary indicator on every reading |

### High-confidence hypotheses (validate with own data)

| Insight | Hypothesis | Data needed |
|---|---|---|
| **Monsoon washout** | Rainfall drops PM 40–60% for 6–12h | Precipitation (own station) |
| **Weekend/Poya effect** | Corridor PM drops 20–35% on Poya days | 3+ months corridor data |
| **School-gate microhotspot** | Idling queues create a plume distinct from the corridor baseline | Paired school-gate + corridor sensors 200m apart |
| **Post-rain resuspension** | PM10 spikes as roads dry, PM2.5 does not | PM10/PM2.5 ratio + rainfall |
| **Exam-season congestion** | O/L and A/L periods elevate PM near exam centres | Exam calendar + corridor data |

### Cultural / seasonal detectors (your suggestions, formalised)

| Event | Hypothesis | Note |
|---|---|---|
| **Avurudu (April)** | *Ambiguous and worth testing.* Outbound travel surges on highways, but Colombo depopulates — corridor PM may **fall** in the city while intercity corridors spike. A genuinely novel finding either way. | Needs stations on both city and intercity corridors |
| **Vesak (May)** | Evening PM spike from lantern displays, oil lamps, dansal crowds and heavy evening traffic into display areas | Hourly resolution essential |
| **New Year / Christmas / Deepavali** | Firecracker events produce sharp, short PM and metal-species spikes | Sub-hourly resolution |
| **Open burning** | Early-morning garden and waste burning in dry periods; localised, sharp, wind-direction dependent | Wind direction critical |
| **Construction dust** | Sustained PM10 elevation, low PM2.5/PM10 ratio, weekday-only | PM10 + PM2.5 ratio |

### Derived child-specific metrics

These are what differentiate us from a generic AQI app.

1. **Child Exposure Score** — cumulative 7-day exposure weighted for a child's higher
   ventilation rate per kg body mass. Instantaneous AQI is the wrong unit for a
   growing lung; cumulative dose is the right one.
2. **Breathing-zone adjustment** — a child at ~1.0 m stands closer to exhaust height
   than a sensor at 2.5–3 m. Apply a documented, conservative correction factor and
   publish the method.
3. **Safe Commute Window** — for a stated route and school start time, the departure
   window minimising exposure.
4. **School Day Exposure Budget** — total exposure accrued across a school day,
   broken into commute / outdoor break / PE.
5. **Asthma Risk Translation** — using the published Sri Lankan coefficient (each
   10 µg/m³ PM2.5 → +4.67% paediatric asthma hospitalisation), express today's level
   as a relative risk change against the local baseline. **Framed as population-level
   risk translation, never as individual prediction or medical advice.**

---

## 8. Screens

Mobile-first. Assume a school administrator on a phone, thirty seconds, once a day.

### 8.1 Home — "Today's Advisory"

The single most important screen. It answers one question before any number appears.

```
┌──────────────────────────────────────┐
│  Demo data ⓘ                    ⚙︎  │
├──────────────────────────────────────┤
│                                      │
│   OUTDOOR ACTIVITY: OK               │
│   with a note                        │
│                                      │
│   Air is acceptable for most         │
│   children today. Children with      │
│   asthma should have inhalers        │
│   available during PE.               │
│                                      │
├──────────────────────────────────────┤
│  Nugegoda – High Level Road          │
│                                      │
│      34          Above WHO           │
│   SL AQI · Good  24h guideline       │
│                  18 µg/m³ vs 15      │
├──────────────────────────────────────┤
│  Peak window today  07:15 – 08:30    │
│  Best drop-off      before 07:00     │
├──────────────────────────────────────┤
│  [ 7-day trend sparkline ]           │
└──────────────────────────────────────┘
```

Advisory states: **OK** / **OK with a note** / **Limit outdoor activity** /
**Move activities indoors** / **Keep children indoors**.

Note the deliberate tension shown on the card: SL AQI says Good, WHO status says
Above. Surfacing that disagreement *is* the product. Never hide it.

### 8.2 Map

- Station pins coloured by selected index, with the scale name always visible
- Filter by `site_class` and by `source_type`
- Distinguish own stations from public feeds visually (shape or border, not colour)
- Tap → station detail

### 8.3 Station detail

- Current values, all parameters, nulls shown as "not measured" not as zero
- 24h / 7d / 30d / 12mo charts
- WHO exceedance days highlighted on the 30d view
- Provenance panel: source, calibration state, last co-location date
- Download CSV

### 8.4 School view

- Register a school (name, location, start/end times, nearest stations)
- Daily advisory tailored to that school's schedule
- Historical: "Your school exceeded WHO guidance on 17 of the last 30 days"
- Printable/shareable daily notice for parents (Sinhala / Tamil / English)

### 8.5 Commute planner

- Origin, destination, arrival time
- Exposure by departure time, plotted
- Recommended window

### 8.6 Haze Season Watch (seasonal, Oct–Dec)

- Multi-day forecast
- Back-trajectory context where available
- Downloadable school action plan
- Push/email alert opt-in

### 8.7 Open data

- Browse all stations, all history
- CSV / JSON download
- API documentation
- Methodology page — calibration approach, index formulas, correction factors,
  known limitations. Publishing this is a credibility asset, not a liability.

---

## 9. Public API

```
GET  /api/v1/stations
GET  /api/v1/stations/{id}
GET  /api/v1/stations/{id}/readings?from=&to=&aggregation=
GET  /api/v1/readings/latest?bbox=&site_class=
GET  /api/v1/advisory?lat=&lng=&profile=school|general|sensitive
GET  /api/v1/insights?station_id=&type=
GET  /api/v1/forecast?station_id=&horizon=72h
GET  /api/v1/schools/{id}/advisory
```

All responses carry the provenance block. Rate-limited, no auth for read.
CORS open — we want people building on this.

---

## 10. Technical architecture

```
┌─────────────────────────────────────────────────────┐
│  Stations (real)          Simulation Service        │
│  AirGradient Open Air     Python, MQTT              │
└──────────────┬──────────────────┬───────────────────┘
               │      MQTT        │
               ▼                  ▼
      ┌────────────────────────────────┐
      │   ThingsBoard CE               │
      │   device mgmt, ingest, alarms  │
      └──────────────┬─────────────────┘
                     │
      ┌──────────────▼─────────────────┐      ┌──────────────────┐
      │   TimescaleDB / PostgreSQL     │◄─────┤ Public feed       │
      │   canonical readings + prov.   │      │ ingestors (ETL)   │
      └──────────────┬─────────────────┘      │ CEA/NBRO/WAQI/    │
                     │                        │ aqi.in/Met Dept   │
      ┌──────────────▼─────────────────┐      └──────────────────┘
      │   Python services              │
      │   · RH calibration             │
      │   · index calculation          │
      │   · insight detectors          │
      │   · forecasting                │
      └──────────────┬─────────────────┘
                     │
      ┌──────────────▼─────────────────┐
      │   API layer (FastAPI)          │
      └──────────────┬─────────────────┘
                     │
      ┌──────────────▼─────────────────┐
      │   Web app (React, PWA)         │
      │   mobile-first, si/ta/en       │
      └────────────────────────────────┘
                     │
                     └──────────► OpenAQ (outbound publish)
```

### Architectural rules

1. **ThingsBoard is the device and telemetry layer only.** No calibration models, no
   index maths, no insight detection in rule chains.
2. **The web app never talks to ThingsBoard directly.** It talks to our API.
3. **Tenancy lives in our app layer, not in ThingsBoard customers.** CE lacks the
   RBAC and white-labeling to model schools/hotels as tenants; fighting the platform
   on this is a known cost sink.
4. **One shared index library** used by backend, simulator and tests. Index maths
   must never be reimplemented.
5. **Simulation is a peer of a real station**, not a special case in the app.

### Repository layout

```
/apps
  /web              React PWA
  /api              FastAPI
/services
  /simulator        station simulator
  /ingestors        CEA, NBRO, WAQI, aqi.in, Met
  /calibration      RH correction, drift
  /insights         detector library
  /forecast
/packages
  /aqi-core         SL/US/WHO index library (the single source of truth)
  /schemas          canonical types
/docs
  /methodology      calibration, corrections, limitations
  /hardware         station BOM, siting guide
  /deployment
/infra              docker, k8s, terraform
```

---

## 11. Open source & data licensing

| Asset | Licence | Rationale |
|---|---|---|
| Application code | **Apache 2.0** | Matches ThingsBoard CE; permissive, no friction for government adoption |
| Hardware designs / mods | **CC-BY-SA 4.0** | Matches AirGradient upstream |
| Data | **CC-BY 4.0** or **ODbL** | Attribution required; ODbL if we want derived networks to stay open |
| Documentation & methodology | **CC-BY 4.0** | |

### Commitments

- Publish to **OpenAQ** from first live station. Cheap, high-leverage, immediate
  international visibility and researcher access.
- Publish the calibration methodology and correction coefficients openly, but clearly
  versioned and marked as site- and season-specific rather than universal.
- Attribute CEA, NBRO, FECT and OSC clearly wherever their data appears. This is both
  correct and the groundwork for future formal cooperation.

---

## 12. Data protection principles

Sri Lanka's PDPA No. 9 of 2022 (as amended by Act No. 22 of 2025) is administered by
the Data Protection Authority, with commencement phased. Design to it now.

1. **No individual-level health records. Ever.** Any health linkage is aggregate,
   ward- or district-level, ideally k-anonymised.
2. **No child-level data.** School registration captures the institution, not pupils.
   No named children, no attendance, no health status.
3. **Commute planner runs client-side or is stateless.** Route inputs are not stored.
4. **Explicit, plain-language consent** for any parent-facing alerts, in all three
   languages.
5. **Data minimisation** — collect only what a stated feature requires.
6. **Publish a data protection statement** before go-live, and treat any hospital or
   university partnership as requiring ethics clearance.

Framing the platform as never touching individual data is also the cleanest possible
answer for a UNICEF child-safeguarding review.

---

## 13. Risks and mitigations

| Risk | Severity | Mitigation |
|---|---|---|
| **Calibration failure in high RH** | Critical | Co-locate 2 units at a CEA reference for 6–8 weeks pre-deployment; RH-corrected model; re-colocate every 6–12 months. Untreated optical sensors read badly high at Colombo humidity |
| **Index confusion (SL vs US vs WHO)** | High | Always label the scale; never display a bare number |
| **Perceived as competing with CEA** | High | Position as densification + interpretation layer; ingest and attribute their data prominently; approach early |
| **Simulated data mistaken for real** | High | Provenance field + demo chip + `DATA_MODE` flag |
| **Advisory liability** | High | Population-level guidance only; explicit non-medical-advice framing; no individual predictions |
| **Sensor loss/vandalism at corridor sites** | Medium | Host on institutional premises where possible; tamper alerts; budget 10% attrition |
| **Power/connectivity at corridor sites** | Medium | Solar + battery; store-and-forward buffering; 4G with SIM redundancy |
| **Sensor drift** | Medium | Automated drift detection against network median; scheduled re-colocation |
| **Funding not granted** | Medium | Commercial model below must stand alone |
| **Key-person dependency** | Medium | Open source from day one; document as you build |

---

## 14. Commercial model

Required by the UNICEF application, and necessary regardless.

| Stream | Bankability | Notes |
|---|---|---|
| **Construction & EIA compliance monitoring** | **Highest** | CEA-mandated ambient monitoring during projects has existing budget lines. Boring, contracted, recurring. Funds everything else |
| **Hardware + installation + monitored SLA** | High | Industrial estates, corporates, international schools, hotel groups. Plays directly to existing ThingsBoard delivery capability |
| **Grants / donor funding** | High | UNICEF, AFD, Clean Air Fund, WHO, ADB all active regionally. A fully open, child-health-framed project is directly fundable |
| **Data services for research** | Medium | Custom extracts, study support, co-authorship |
| **Schools / parents / public** | **Free, permanently** | Legitimacy, data-sharing leverage, and the reason the rest is fundable |
| **Hotels / "clean air certified"** | Deferred | Requires independent credibility first — phase 3 |

**Software is never the revenue.** Revenue is hardware, installation, assured
operation, and compliance reporting. This is what makes full open-sourcing coherent
rather than self-defeating.

---

## 15. Phasing

### Phase 0 — Foundations (now → +3 months)
- Finalise station BOM (AirGradient Open Air as baseline; add NO2 and wind)
- Procure 3 units, co-locate at CEA Battaramulla, build RH correction model
- Build simulator, ingestors, `aqi-core`, and the web app against simulated data
- **MVP demo live at aqi.thingsnode.cc with demo chip**
- Open initial conversations: CEA, a university (Peradeniya / Colombo), Ministry of Education
- Submit UNICEF application

### Phase 1 — Deployment (+3 → +8 months)
- Deploy 15 stations, stratified siting (see below)
- Flip `DATA_MODE` to live; remove demo chip
- Ship School Advisory + Commute Window
- Ingest CEA/NBRO/WAQI/aqi.in in production

### Phase 2 — Credibility (+8 → +12 months)
- Full open-source release
- Begin publishing to OpenAQ
- Publish calibration methodology note
- Ship Haze Season Watch ahead of October
- Validate the insight detectors against a full seasonal cycle

### Phase 3 — Scale & health linkage (+12 months)
- Expand toward 50+ stations, national corridors and tourist areas
- Retrospective health correlation study with hospital/university partner
- Launch construction/EIA compliance product
- Corridor NO2 network

### Siting plan for the 15 (Phase 1)

Placement determines whether the network is scientifically interpretable or merely
commercially placed. Suggested allocation:

| Count | Site class | Purpose |
|---|---|---|
| 2 | REFERENCE_COLOCATED | Calibration anchor at CEA/NBRO reference |
| 1 | BACKGROUND | Clean upwind/coastal control |
| 5 | TRAFFIC_CORRIDOR | Kandy Rd, Negombo Rd, Galle Rd, High Level Rd, Baseline Rd |
| 4 | SCHOOL | Paired with corridor sites where possible, to isolate the school-gate effect |
| 2 | INDUSTRIAL | Port / industrial zone |
| 1 | COASTAL | Sea-breeze / transboundary inflow signal |

Pairing school sites 200–400 m from a corridor site is what lets you prove the
school-gate microhotspot hypothesis — the finding most likely to generate press and
policy attention.

---

## 16. UNICEF application alignment

| Requirement | How this addresses it |
|---|---|
| Child-focused outcome | Advisory targeted at schools and parents; child-weighted exposure metrics |
| Measurable impact | Days of avoided exposure; schools issuing advisories; WHO exceedance days surfaced |
| Evidence base | Sri Lankan coefficient (+4.67% paediatric asthma hospitalisation per 10 µg/m³ PM2.5); urban schoolchild asthma prevalence 10–15% |
| Open / replicable | Apache 2.0 code, CC-BY data, open hardware, OpenAQ publication |
| Commercial sustainability | Section 14 |
| Safeguarding | Section 12 — no individual or child-level data by design |
| Novel contribution | **The WHO/SL AQI gap: 57% of days exceed WHO guidance while 93% read "Good" nationally.** No existing platform surfaces this |
| Local partnership | CEA, NBRO, universities, Ministry of Education |

---

## 17. Immediate next steps

1. Confirm working name and visual identity → **Claude Design**
2. Build `aqi-core` index library with the verified SL AQI formulas + full test suite
3. Build simulation service seeded from the attached CEA distribution
4. Build ingestors for CEA (JSON) and NBRO (PDF parse)
5. Design and build Home / Map / Station Detail / School View → **Claude Design + Claude Code**
6. Draft the UNICEF narrative around Section 2 (the thesis)
7. Finalise station BOM and get the 3 co-location units on order — this is the long
   pole and should start now

---

## Appendix A — Verified index formulas

Derived from 30 records of aq.cea.lk daily API data and cross-validated against the
NBRO daily bulletin of 22/07/2026.

```python
def sl_aqi_pm25(pm25_ug_m3: float) -> int:
    """Sri Lanka AQI from 24h mean PM2.5. Verified max error ±1 over 30 records."""
    return round(2 * pm25_ug_m3)

def sl_aqi_pm10(pm10_ug_m3: float) -> int:
    """Sri Lanka AQI from 24h mean PM10. Verified exact over 30 records."""
    return round(pm10_ug_m3)

SL_BANDS = [
    (0,   50,  "Good"),
    (51,  100, "Moderate"),
    (101, 150, "Slightly Unhealthy"),
    (151, 200, "Unhealthy"),
    (201, 300, "Very Unhealthy"),
    (301, 500, "Hazardous"),
]

WHO_PM25_24H_GUIDELINE = 15.0   # µg/m³
WHO_PM25_ANNUAL_GUIDELINE = 5.0 # µg/m³
```

**Validation note:** the relationship should be re-verified against a wider
concentration range once haze-season data (SL AQI > 100) is available. The linear
form is confirmed only across the observed 20–56 range.

## Appendix B — Reference data snapshot

Location 3 (aq.cea.lk), 29 Jun – 28 Jul 2026, daily means:

- PM2.5: mean 15.9, min 10.4, max 28.1 µg/m³
- PM10: mean 29.0, min 19.7, max 45.4 µg/m³
- RH: mean ~79.9%, range 74.8–90.0%
- Temperature: mean ~30.6 °C
- Gases (O3, NO2, CO, SO2): all null
- Wind, precipitation, cloud: all null

Use this distribution to seed the simulator's SW-monsoon baseline.
