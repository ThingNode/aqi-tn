import asyncio
import csv
import io
import json
import os
from collections import defaultdict
from contextlib import asynccontextmanager
from datetime import datetime, timedelta, timezone
from pathlib import Path
from uuid import uuid4

import yaml
from fastapi import FastAPI, HTTPException, Query, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response

from aqi_core import sl_aqi, us_aqi_pm25, who_pm25_status
from aqi_schemas import CanonicalReading, Measurement, Provenance, Station

# Kept importable in a source checkout and copied into the API image in production.
from services.calibration.calibration import PLACEHOLDER_MODEL_VERSION, correct_optical_pm
from .thingsboard_bridge import ThingsBoardBridge

ROOT = Path(__file__).resolve().parents[3]
REGISTRY = Path(os.getenv("STATION_REGISTRY", ROOT / "config" / "stations.yaml"))
EXPOSURE_REFERENCE_MULTIPLIER = float(os.getenv("EXPOSURE_REFERENCE_MULTIPLIER", "4"))


def load_stations() -> list[Station]:
    return [Station.model_validate(item) for item in yaml.safe_load(REGISTRY.read_text(encoding="utf-8"))["stations"]]


class ReadingStore:
    """Development store behind the same repository boundary as Timescale.

    Production wiring persists through the SQL schema in ``db/schema.sql``. This
    bounded store keeps source-checkout development useful without faking API files.
    """
    def __init__(self):
        self.by_station: dict[str, list[CanonicalReading]] = defaultdict(list)
        self.clients: set[WebSocket] = set()

    async def add(self, reading: CanonicalReading) -> None:
        self.by_station[reading.station_id].append(reading)
        message = {"type": "reading", **reading.model_dump(mode="json")}
        for client in list(self.clients):
            try:
                await client.send_json(message)
            except Exception:
                self.clients.discard(client)


store = ReadingStore()
stations = load_stations()
station_by_id = {station.id: station for station in stations}


@asynccontextmanager
async def lifespan(_: FastAPI):
    global bridge_task
    if bridge.configured:
        bridge_task = asyncio.create_task(bridge.run(), name="thingsboard-telemetry")
    yield
    bridge.stop()
    if bridge_task:
        bridge_task.cancel()


app = FastAPI(title="aqi.thingsnode API", version="0.1.0", docs_url="/api/v1/docs", lifespan=lifespan)
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_methods=["GET"], allow_headers=["*"])


def canonicalize(station_id: str, ts: datetime, values: dict) -> CanonicalReading:
    pm25_raw = float(values["pm2_5_raw"])
    pm10_raw = float(values["pm10_raw"])
    humidity = float(values["humidity"])
    if pm25_raw > 1000 or pm10_raw > 2000:
        raise ValueError("particulate value outside accepted sensor range")
    pm25 = correct_optical_pm(pm25_raw, humidity)
    pm10 = correct_optical_pm(pm10_raw, humidity)
    sl = sl_aqi(pm25_ug_m3=pm25, pm10_ug_m3=pm10)
    us = us_aqi_pm25(pm25)
    return CanonicalReading(
        reading_id=str(uuid4()), station_id=station_id, timestamp_utc=ts,
        measurements={"pm1": Measurement(value=values.get("pm1", 0), unit="ug/m3"), "pm2_5": Measurement(value=pm25, unit="ug/m3"), "pm10": Measurement(value=pm10, unit="ug/m3")},
        meteorology={"temperature_c": values.get("temperature"), "humidity_pct": humidity, "pressure_hpa": values.get("pressure"), "wind_speed_ms": values.get("wind_speed"), "wind_direction_deg": values.get("wind_direction"), "precipitation_mm": values.get("precipitation")},
        indices={"sl_aqi": {"value": sl.value, "band": sl.band, "dominant": sl.dominant, "validated": sl.validated}, "us_aqi": {"value": us.value, "band": us.band, "dominant": us.dominant}, "who_24h": who_pm25_status(pm25)},
        provenance=Provenance(source_type=values.get("source_type", "OWN_SENSOR"), source_name="Simulation Service v1" if values.get("source_type") == "SIMULATED" else "ThingsNode station", calibration_state="RH_CORRECTED", confidence="LOW", aggregation="INSTANT"),
        raw={"pm2_5_raw": pm25_raw, "pm10_raw": pm10_raw, "humidity": humidity},
    )


async def ingest_thingsboard(station_id: str, ts: datetime, values: dict) -> None:
    try:
        reading = canonicalize(station_id, ts, values)
    except (KeyError, TypeError, ValueError):
        # Fault injection deliberately reaches this boundary. Invalid telemetry is
        # rejected while remaining available in ThingsBoard for diagnostics.
        return
    await store.add(reading)


bridge = ThingsBoardBridge(ingest_thingsboard)
bridge_task: asyncio.Task | None = None


@app.get("/api/v1/health")
def health():
    return {"status": "ok", "data_mode": os.getenv("DATA_MODE", "demo")}


@app.get("/api/v1/stations")
def list_stations():
    return stations


@app.get("/api/v1/stations/{station_id}")
def station_detail(station_id: str):
    return station_by_id[station_id]


@app.get("/api/v1/readings/latest")
def latest():
    return [items[-1] for items in store.by_station.values() if items]


@app.get("/api/v1/readings/snapshot")
def snapshot(stations: str = Query(default="")):
    ids = stations.split(",") if stations else station_by_id.keys()
    return [store.by_station[item][-1] for item in ids if store.by_station[item]]


@app.get("/api/v1/stations/{station_id}/readings")
def history(station_id: str, from_: datetime | None = Query(None, alias="from"), to: datetime | None = None, aggregation: str = "hour"):
    start = from_ or datetime.now(timezone.utc) - timedelta(days=7)
    end = to or datetime.now(timezone.utc)
    return [reading for reading in store.by_station[station_id] if start <= reading.timestamp_utc <= end]


@app.get("/api/v1/meta/bands")
def bands():
    return {"who_pm25_24h": 15.0, "exposure_reference_multiplier": EXPOSURE_REFERENCE_MULTIPLIER, "rh_model": PLACEHOLDER_MODEL_VERSION}


@app.get("/api/v1/export")
def export_readings(stations_query: str = Query(default="", alias="stations"), format: str = "csv"):
    selected_ids = set(stations_query.split(",")) if stations_query else set(station_by_id)
    readings = [reading for station_id, items in store.by_station.items() if station_id in selected_ids for reading in items]
    readings.sort(key=lambda item: item.timestamp_utc)
    if format == "json":
        payload = json.dumps([reading.model_dump(mode="json") for reading in readings])
        return Response(payload, media_type="application/json", headers={"Content-Disposition": "attachment; filename=aqi-thingsnode-readings.json"})
    if format != "csv":
        raise HTTPException(status_code=400, detail="format must be csv or json")
    output = io.StringIO()
    writer = csv.writer(output, lineterminator="\n")
    writer.writerow(["timestamp_utc", "station_id", "pm2_5_ug_m3", "pm10_ug_m3", "sl_aqi", "sl_aqi_band", "source_type", "calibration_state", "confidence"])
    for reading in readings:
        writer.writerow([reading.timestamp_utc.isoformat(), reading.station_id, reading.measurements["pm2_5"].value, reading.measurements["pm10"].value, reading.indices["sl_aqi"]["value"], reading.indices["sl_aqi"]["band"], reading.provenance.source_type, reading.provenance.calibration_state, reading.provenance.confidence])
    return Response(output.getvalue(), media_type="text/csv", headers={"Content-Disposition": "attachment; filename=aqi-thingsnode-readings.csv"})


@app.websocket("/api/v1/ws")
async def realtime(websocket: WebSocket):
    await websocket.accept()
    store.clients.add(websocket)
    try:
        while True:
            try:
                await asyncio.wait_for(websocket.receive_json(), timeout=25)
            except TimeoutError:
                await websocket.send_json({"type": "heartbeat", "ts": int(datetime.now(timezone.utc).timestamp() * 1000)})
    except WebSocketDisconnect:
        store.clients.discard(websocket)
