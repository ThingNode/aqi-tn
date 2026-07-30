from datetime import datetime, timedelta, timezone

from simulator.model import SignalModel

STATION = {"id": "test", "site_class": "TRAFFIC_CORRIDOR"}


def corrected_pm25(reading: dict) -> float:
    rh_excess = max(0.0, reading["humidity"] - 50.0) / 50.0
    inflation = 1 + 0.35 * rh_excess + 0.25 * rh_excess**2
    return reading["pm2_5_raw"] / inflation


def angular_distance(one: float, two: float) -> float:
    return abs((one - two + 180) % 360 - 180)


def test_model_is_reproducible_and_marks_provenance():
    at = datetime(2026, 8, 1, 2, 30, tzinfo=timezone.utc)
    one = SignalModel(42, False).generate(STATION, at)
    two = SignalModel(42, False).generate(STATION, at)
    assert one == two
    assert one["source_type"] == "SIMULATED"
    assert one["pm2_5_raw"] > 0


def test_haze_season_is_higher_for_same_station_and_clock_time():
    model = SignalModel(42, False)
    august = model.generate(STATION, datetime(2026, 8, 3, 2, tzinfo=timezone.utc))
    november = model.generate(STATION, datetime(2026, 11, 2, 2, tzinfo=timezone.utc))
    assert november["pm2_5_raw"] > august["pm2_5_raw"]


def test_raw_value_includes_humidity_inflation():
    reading = SignalModel(7, False).generate(STATION, datetime(2026, 8, 1, tzinfo=timezone.utc))
    assert reading["humidity"] >= 55
    assert reading["pm10_raw"] > reading["pm2_5_raw"]


def test_two_demo_hotspots_stay_in_unhealthy_visualization_range():
    at = datetime(2026, 8, 1, 2, 30, tzinfo=timezone.utc)
    model = SignalModel(42, False)
    for station_id in ("sta-cor-baseline-borella", "sta-sch-peliyagoda"):
        reading = model.generate({"id": station_id, "site_class": "TRAFFIC_CORRIDOR"}, at)
        assert 75.5 <= corrected_pm25(reading) <= 100


def test_wind_is_coherent_across_nearby_stations():
    at = datetime(2026, 8, 1, 2, 30, tzinfo=timezone.utc)
    model = SignalModel(42, False)
    borella = model.generate({"id": "sta-cor-baseline-borella", "site_class": "TRAFFIC_CORRIDOR"}, at)
    nugegoda = model.generate({"id": "sta-cor-hlr-nugegoda", "site_class": "TRAFFIC_CORRIDOR"}, at)
    assert angular_distance(borella["wind_direction"], nugegoda["wind_direction"]) < 10
    assert abs(borella["wind_speed"] - nugegoda["wind_speed"]) < 0.5


def test_wind_changes_smoothly_between_publish_intervals():
    at = datetime(2026, 8, 1, 2, 30, tzinfo=timezone.utc)
    model = SignalModel(42, False)
    now = model.generate(STATION, at)
    next_reading = model.generate(STATION, at + timedelta(minutes=5))
    assert angular_distance(now["wind_direction"], next_reading["wind_direction"]) < 2
    assert abs(now["wind_speed"] - next_reading["wind_speed"]) < 0.2
