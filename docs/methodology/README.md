# Methodology and known limitations

## Index calculations

`packages/aqi-core` is the only implementation of SL AQI, US EPA AQI (2024 PM2.5
breakpoints), and WHO status. Browsers consume calculated indices from the API. The
inferred Sri Lanka relationships are `round(2 × PM2.5)` and `round(PM10)`. Supplied
research validates these only over SL AQI 20–56; values outside that interval are
explicitly marked as extrapolated by the library.

## Humidity correction

`rh-polynomial-placeholder-v1` divides raw optical PM by
`1 + 0.35e + 0.25e²`, where `e = max(0, RH − 50) / 50`. This polynomial exists to
exercise raw/corrected data handling in demo mode. It is **not a calibration result**
and corrected demo readings therefore have low confidence. Replace it with
versioned station-specific coefficients after 6–8 weeks of reference co-location.
Raw measurements are retained permanently.

## Exposure reference

The configurable exposure reference is `4 × WHO PM2.5 24-hour guideline × window
hours`. The WHO point is consequently 25% of the full exposure scale. Claude's final
design uses this value for atmospheric-field extent and the station detail exposure
bar; it supersedes the earlier vertical-column proposal, which saturated too soon.

## Simulation

Simulation is a separate, discardable service. It emits raw MQTT telemetry with
`source_type: SIMULATED`, including dropouts, stuck values, drift, and deliberately
invalid samples. Its SW-monsoon baseline comes from aggregate CEA summary statistics,
not from an included daily dataset. Simulated values must not be represented as
measurements.

