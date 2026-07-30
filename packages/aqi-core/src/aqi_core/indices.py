"""Index functions used by the API and simulator.

The inferred Sri Lankan linear relationship is validated by the supplied research
only for SL AQI 20–56. Results outside that interval are deliberately returned—the
published bands require them—but callers can inspect ``validated`` and must not
describe extrapolated values as independently verified.
"""

from dataclasses import dataclass
from decimal import Decimal, ROUND_HALF_UP
from enum import StrEnum

WHO_PM25_24H_GUIDELINE = 15.0
WHO_PM25_ANNUAL_GUIDELINE = 5.0
SL_VALIDATED_MIN = 20
SL_VALIDATED_MAX = 56

SL_BANDS = (
    (0, 50, "Good"), (51, 100, "Moderate"),
    (101, 150, "Slightly Unhealthy"), (151, 200, "Unhealthy"),
    (201, 300, "Very Unhealthy"), (301, 500, "Hazardous"),
)

# US EPA 2024 PM2.5 AQI breakpoints. Input is truncated to 0.1 µg/m³ first.
US_PM25_BREAKPOINTS = (
    (0.0, 9.0, 0, 50, "Good"), (9.1, 35.4, 51, 100, "Moderate"),
    (35.5, 55.4, 101, 150, "Unhealthy for Sensitive Groups"),
    (55.5, 125.4, 151, 200, "Unhealthy"),
    (125.5, 225.4, 201, 300, "Very Unhealthy"),
    (225.5, 325.4, 301, 500, "Hazardous"),
)


class WHOStatus(StrEnum):
    WITHIN = "WITHIN"
    EXCEEDS = "EXCEEDS"


@dataclass(frozen=True)
class IndexResult:
    value: int
    band: str
    dominant: str
    validated: bool = True


def _half_up(value: float) -> int:
    return int(Decimal(str(value)).quantize(Decimal("1"), rounding=ROUND_HALF_UP))


def _require_nonnegative(value: float, name: str) -> None:
    if value < 0:
        raise ValueError(f"{name} cannot be negative")


def _sl_band(value: int) -> str:
    for low, high, label in SL_BANDS:
        if low <= value <= high:
            return label
    return "Beyond index" if value > 500 else "Good"


def sl_aqi_pm25(pm25_ug_m3: float) -> int:
    _require_nonnegative(pm25_ug_m3, "PM2.5")
    return _half_up(2 * pm25_ug_m3)


def sl_aqi_pm10(pm10_ug_m3: float) -> int:
    _require_nonnegative(pm10_ug_m3, "PM10")
    return _half_up(pm10_ug_m3)


def sl_aqi(*, pm25_ug_m3: float | None, pm10_ug_m3: float | None) -> IndexResult:
    candidates = []
    if pm25_ug_m3 is not None:
        candidates.append((sl_aqi_pm25(pm25_ug_m3), "pm2_5"))
    if pm10_ug_m3 is not None:
        candidates.append((sl_aqi_pm10(pm10_ug_m3), "pm10"))
    if not candidates:
        raise ValueError("at least one particulate measurement is required")
    value, dominant = max(candidates)
    return IndexResult(value, _sl_band(value), dominant, SL_VALIDATED_MIN <= value <= SL_VALIDATED_MAX)


def us_aqi_pm25(pm25_ug_m3: float) -> IndexResult:
    _require_nonnegative(pm25_ug_m3, "PM2.5")
    concentration = int(pm25_ug_m3 * 10) / 10
    for c_low, c_high, i_low, i_high, band in US_PM25_BREAKPOINTS:
        if c_low <= concentration <= c_high:
            value = _half_up((i_high - i_low) / (c_high - c_low) * (concentration - c_low) + i_low)
            return IndexResult(value, band, "pm2_5")
    return IndexResult(500, "Beyond AQI", "pm2_5", False)


def who_pm25_status(pm25_ug_m3: float, *, annual: bool = False) -> dict[str, float | str]:
    _require_nonnegative(pm25_ug_m3, "PM2.5")
    guideline = WHO_PM25_ANNUAL_GUIDELINE if annual else WHO_PM25_24H_GUIDELINE
    status = WHOStatus.WITHIN if pm25_ug_m3 <= guideline else WHOStatus.EXCEEDS
    return {"status": status.value, "guideline": guideline, "ratio": round(pm25_ug_m3 / guideline, 3)}

