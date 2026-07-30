from datetime import datetime, timezone
from fastapi.testclient import TestClient

from app.main import app, canonicalize


def test_registry_is_public_and_complete():
    response = TestClient(app).get("/api/v1/stations")
    assert response.status_code == 200
    assert len(response.json()) == 15


def test_canonicalization_preserves_raw_and_attaches_provenance():
    reading = canonicalize("sta-cor-hlr-nugegoda", datetime.now(timezone.utc), {"pm1": 8, "pm2_5_raw": 20, "pm10_raw": 35, "humidity": 80, "source_type": "SIMULATED"})
    assert reading.raw["pm2_5_raw"] == 20
    assert reading.measurements["pm2_5"].value < 20
    assert reading.provenance.source_type == "SIMULATED"
    assert "sl_aqi" in reading.indices


def test_export_returns_a_real_csv_contract():
    response = TestClient(app).get("/api/v1/export?format=csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert response.text.startswith("timestamp_utc,station_id,pm2_5_ug_m3")


def test_export_rejects_unknown_format():
    response = TestClient(app).get("/api/v1/export?format=xml")
    assert response.status_code == 400
