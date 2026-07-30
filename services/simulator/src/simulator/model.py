"""Reproducible Sri Lankan particulate signal model.

This model is synthetic. It is based on the aggregate CEA distribution supplied in
the product plan and must never be described as observed station telemetry.
"""

from dataclasses import dataclass
from datetime import datetime
from math import cos, exp, pi, sin
from random import Random
from zoneinfo import ZoneInfo

COLOMBO = ZoneInfo("Asia/Colombo")
SITE_MULTIPLIERS = {
    "BACKGROUND": 1.0, "COASTAL": 0.9, "REFERENCE_COLOCATED": 1.08,
    "TRAFFIC_CORRIDOR": 1.58, "SCHOOL": 1.05, "INDUSTRIAL": 1.72,
}

# Stable ThingsBoard device IDs used as demo visualization profiles. Keeping the
# corrected targets in the Unhealthy SL-AQI range makes the map exercise its
# orange band without presenting these synthetic values as observations.
UNHEALTHY_DEMO_TARGETS = {
    "sta-cor-baseline-borella": 82.0,
    "sta-sch-peliyagoda": 90.0,
}


@dataclass(frozen=True)
class Fault:
    kind: str
    station_id: str


class SignalModel:
    def __init__(self, seed: int = 42, fault_injection: bool = True):
        self.seed = seed
        self.fault_injection = fault_injection
        self._stuck: dict[str, tuple[float, float]] = {}

    def _random(self, station_id: str, timestamp: datetime) -> Random:
        bucket = int(timestamp.timestamp() // 300)
        return Random(f"{self.seed}:{station_id}:{bucket}")

    @staticmethod
    def _peak(hour: float, centre: float, width: float) -> float:
        return exp(-0.5 * ((hour - centre) / width) ** 2)

    def _wind(self, station_id: str, local: datetime, rain: float) -> tuple[float, float]:
        """Return a smooth synthetic Colombo wind field in meteorological degrees.

        Nearby stations share a synoptic direction and diurnal speed cycle, with
        only a small stable site offset. This is deliberately illustrative rather
        than a weather observation or forecast.
        """
        station_code = sum((index + 1) * ord(char) for index, char in enumerate(station_id))
        phase = ((station_code + self.seed * 17) % 360) * pi / 180
        elapsed_hours = local.timestamp() / 3600

        if local.month in (5, 6, 7, 8, 9):
            prevailing_from = 225.0  # south-west monsoon
        elif local.month in (12, 1, 2):
            prevailing_from = 45.0  # north-east monsoon
        else:
            prevailing_from = 170.0  # variable inter-monsoon flow

        synoptic_turn = 14 * sin(elapsed_hours / 18) + 6 * sin(elapsed_hours / 5.5)
        local_turn = 4 * sin(phase)
        direction_from = (prevailing_from + synoptic_turn + local_turn) % 360

        hour = local.hour + local.minute / 60
        diurnal = 0.5 + 0.5 * sin((hour - 9) / 24 * 2 * pi)
        shared_gust = 0.24 * sin(elapsed_hours / 3.8)
        local_gust = 0.16 * sin(elapsed_hours / 2.7 + phase)
        rain_gust = min(0.7, rain * 0.08)
        speed = max(0.35, 1.55 + 1.25 * diurnal + shared_gust + local_gust + rain_gust)
        return speed, direction_from

    def generate(self, station: dict, timestamp: datetime, *, poya: bool = False) -> dict | None:
        local = timestamp.astimezone(COLOMBO)
        rng = self._random(station["id"], timestamp)
        fault_roll = rng.random()
        if self.fault_injection and fault_roll < 0.002:
            return None  # dropout

        # SW monsoon is the supplied 15.9 µg/m³ baseline. Oct–Dec haze uses a
        # smooth, multi-day envelope rather than independent random spikes.
        seasonal = 1.0
        if local.month in (10, 11, 12):
            seasonal = 2.1 + 1.2 * (0.5 + 0.5 * sin(local.timetuple().tm_yday / 5.5))
        elif local.month in (1, 2, 3):
            seasonal = 1.35

        hour = local.hour + local.minute / 60
        peaks = 0.72 + 0.42 * self._peak(hour, 8.0, 1.25) + 0.30 * self._peak(hour, 14.0, 1.4)
        if station["site_class"] == "SCHOOL":
            peaks += 0.38 * self._peak(hour, 7.5, 0.65) + 0.32 * self._peak(hour, 13.7, 0.7)
        weekly = 1.0 if local.weekday() < 5 else (0.86 if local.weekday() == 5 else 0.72)
        if poya:
            weekly = 0.70

        humidity = max(55.0, min(96.0, 80 + 8 * cos((hour - 4) / 24 * 2 * pi) + rng.gauss(0, 1.5)))
        temperature = 29.5 + 3.2 * sin((hour - 8) / 24 * 2 * pi) + rng.gauss(0, 0.25)
        rain = max(0.0, rng.gauss(3.0, 2.0)) if rng.random() < 0.025 else 0.0
        washout = rng.uniform(0.40, 0.60) if rain else 1.0
        wind_speed, wind_direction = self._wind(station["id"], local, rain)
        base = 15.9 * seasonal * SITE_MULTIPLIERS[station["site_class"]] * peaks * weekly * washout
        corrected_pm25 = max(0.2, base * (1 + rng.gauss(0, 0.12)))
        if station["id"] in UNHEALTHY_DEMO_TARGETS:
            target = UNHEALTHY_DEMO_TARGETS[station["id"]]
            corrected_pm25 = target * (1 + rng.gauss(0, 0.025))

        # Placeholder hygroscopic inflation paired with the API's documented
        # inverse correction. Coefficients are not a calibration result.
        rh_excess = max(0.0, humidity - 50.0) / 50.0
        inflation = 1 + 0.35 * rh_excess + 0.25 * rh_excess**2
        pm25_raw = corrected_pm25 * inflation
        pm10_raw = pm25_raw * rng.uniform(1.55, 2.05)

        if self.fault_injection and 0.002 <= fault_roll < 0.003:
            self._stuck[station["id"]] = (pm25_raw, pm10_raw)
        if station["id"] in self._stuck:
            pm25_raw, pm10_raw = self._stuck[station["id"]]
        if self.fault_injection and 0.003 <= fault_roll < 0.004:
            pm25_raw += (local.timetuple().tm_yday % 30) * 1.2  # deterministic drift
        if self.fault_injection and 0.004 <= fault_roll < 0.0042:
            pm25_raw = 1400.0  # deliberately rejected downstream

        return {
            "pm1": round(pm25_raw * 0.58, 2), "pm2_5_raw": round(pm25_raw, 2),
            "pm10_raw": round(pm10_raw, 2), "no2": None,
            "temperature": round(temperature, 2), "humidity": round(humidity, 2),
            "pressure": round(1008 + rng.gauss(0, 1.1), 2),
            "wind_speed": round(wind_speed, 2),
            "wind_direction": round(wind_direction, 1),
            "precipitation": round(rain, 2), "battery_v": round(rng.uniform(12.1, 13.1), 2),
            "rssi": rng.randint(-83, -58), "firmware": "sim-1.0.0", "source_type": "SIMULATED",
        }
