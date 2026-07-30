"""Provisional humidity correction.

These coefficients are engineering placeholders, not a field calibration. Replace
them with versioned, station-specific coefficients after reference co-location.
"""

PLACEHOLDER_MODEL_VERSION = "rh-polynomial-placeholder-v1"


def correct_optical_pm(raw_ug_m3: float, humidity_pct: float) -> float:
    if not 0 <= humidity_pct <= 100:
        raise ValueError("relative humidity must be between 0 and 100")
    excess = max(0.0, humidity_pct - 50.0) / 50.0
    inflation = 1.0 + 0.35 * excess + 0.25 * excess**2
    return round(raw_ug_m3 / inflation, 2)

