from app.thingsboard_bridge import telemetry_values


def test_telemetry_message_is_flattened_without_losing_timestamp():
    result = telemetry_values({"pm2_5_raw": [[1785209400000, "13.8"]], "source_type": [[1785209400000, "SIMULATED"]], "no2": [[1785209400000, "null"]]})
    assert result == (1785209400000, {"pm2_5_raw": 13.8, "source_type": "SIMULATED", "no2": None})
