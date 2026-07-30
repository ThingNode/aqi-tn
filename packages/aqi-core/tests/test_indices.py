import pytest

from aqi_core import sl_aqi, sl_aqi_pm10, sl_aqi_pm25, us_aqi_pm25, who_pm25_status


@pytest.mark.parametrize("pm25, expected", [(10.0, 20), (10.4, 21), (15.9, 32), (25.0, 50), (28.1, 56)])
def test_sl_pm25_across_published_observed_range(pm25, expected):
    assert sl_aqi_pm25(pm25) == expected


@pytest.mark.parametrize("pm10, expected", [(19.7, 20), (29.0, 29), (45.4, 45)])
def test_sl_pm10_published_summary_points(pm10, expected):
    assert sl_aqi_pm10(pm10) == expected


def test_sl_aqi_uses_dominant_particulate_and_flags_extrapolation():
    assert sl_aqi(pm25_ug_m3=18, pm10_ug_m3=31).dominant == "pm2_5"
    assert sl_aqi(pm25_ug_m3=80, pm10_ug_m3=90).validated is False


@pytest.mark.parametrize("concentration, expected", [(0, 0), (9.0, 50), (9.1, 51), (35.4, 100), (35.5, 101)])
def test_us_epa_2024_breakpoints(concentration, expected):
    assert us_aqi_pm25(concentration).value == expected


def test_who_boundary_is_inclusive():
    assert who_pm25_status(15)["status"] == "WITHIN"
    assert who_pm25_status(15.01)["status"] == "EXCEEDS"


@pytest.mark.parametrize("function", [sl_aqi_pm25, sl_aqi_pm10, us_aqi_pm25])
def test_negative_concentration_rejected(function):
    with pytest.raises(ValueError):
        function(-0.1)

