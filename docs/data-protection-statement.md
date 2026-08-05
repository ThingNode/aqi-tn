# Data protection statement

This statement describes how aqi.thingsnode collects, processes and retains
data. It applies to the public website, the API, and the underlying station
network.

## Scope of data collected

The platform collects environmental telemetry only:

- Particulate matter (PM1, PM2.5, PM10) and, where hardware supports it,
  gaseous pollutants (NO2)
- Meteorology: temperature, humidity, pressure, wind speed and direction,
  precipitation
- Station device diagnostics: battery voltage, signal strength, firmware
  version
- Derived values: calibrated concentrations, Sri Lanka AQI, US AQI, WHO
  guideline status

Every reading is tagged with a provenance record — source type (own sensor,
a named public feed, or simulated), calibration state, confidence, and
aggregation window — so anyone using the data can see exactly where it came
from and how much to trust it.

## What we do not collect

- **No individual-level health data, ever.** The platform does not collect,
  store, or process any person's medical records, symptoms, or health
  status. Any future linkage between air quality and health outcomes would
  use aggregate, ward- or district-level statistics, not individual records.
- **No child-level data.** School registration on the platform captures the
  institution — name, location, operating hours, nearest stations — never
  the identity, attendance, or health status of any pupil.
- **No account or login data for the public product.** Reading the map,
  station detail, or open data pages requires no account, no login, no
  device identifier tied to a person.
- **No stored location history for individuals.** Location lookups (e.g.
  "check the air near me") run against the browser's own geolocation API
  client-side and are not persisted server-side against any user identity.
  A planned Commute Window feature is specified to remain stateless: route
  inputs are not stored.

## Legal basis and framework

Sri Lanka's Personal Data Protection Act No. 9 of 2022 (as amended by Act
No. 22 of 2025) is the applicable framework, administered by the Data
Protection Authority, with commencement phased. This platform is designed
to meet that standard now rather than retrofit it later:

- **Data minimisation** — only the fields a shipped feature actually needs
  are collected.
- **Purpose limitation** — environmental telemetry is used to compute air
  quality indices and advisories; it is not repurposed for profiling,
  advertising, or any use unrelated to air quality.
- **Explicit, plain-language consent** — any future parent-facing alert
  channel (email/push) will require opt-in consent presented in Sinhala,
  Tamil and English.
- **Openness** — the calibration methodology, index formulas, and known
  limitations are published (`docs/methodology/`), and raw sensor values are
  retained permanently alongside corrected values so nothing is silently
  discarded or hidden.

## Third-party and public data

The platform ingests (or is designed to ingest) public air-quality feeds
from the Central Environmental Authority (CEA), the National Building
Research Organisation (NBRO), the Foundation for Environment, Climate and
Technology (FECT) / WAQI, and aqi.in. These sources are attributed
explicitly wherever their data appears; the platform does not alter or
misrepresent the source of any third-party reading.

## Retention

Raw station telemetry is retained permanently, alongside the
calibration-corrected values computed from it. This is deliberate: it means
a future recalibration (e.g., after reference co-location establishes a
proper humidity-correction model) can be applied retroactively without
having lost the underlying measurement.

## Any future health-data partnership

Any retrospective correlation study linking air quality to child health
outcomes (see the roadmap in `project-plan/Product-Spec.md`) would be
conducted only through a formal partnership with a hospital or university,
using aggregate and de-identified (ideally k-anonymised) data, and only
after that partnership has secured its own ethics clearance. No such
partnership or data linkage exists today.

## Contact

[TBD — add a contact address or form for data protection questions before
publishing this statement publicly]

---

*Last updated: 2026-08-03. This statement should be reviewed whenever a new
feature changes what data the platform collects (e.g., the Commute Window or
School Advisory alert features once built).*
