"""One server-side ThingsBoard subscription, fanned out through the API store."""

import asyncio
import json
import logging
import os
from datetime import datetime, timezone
from typing import Awaitable, Callable
from urllib.parse import quote

from services.thingsboard import ThingsBoardClient

logger = logging.getLogger(__name__)
TELEMETRY_KEYS = "pm1,pm2_5_raw,pm10_raw,no2,temperature,humidity,pressure,wind_speed,wind_direction,precipitation,battery_v,rssi,firmware,source_type"


def telemetry_values(data: dict) -> tuple[int, dict] | None:
    values: dict = {}
    timestamps: list[int] = []
    for key, samples in data.items():
        if not samples:
            continue
        ts, value = samples[0]
        timestamps.append(int(ts))
        if value == "null":
            values[key] = None
        else:
            try:
                values[key] = float(value)
            except (TypeError, ValueError):
                values[key] = value
    return (max(timestamps), values) if timestamps else None


class ThingsBoardBridge:
    def __init__(self, ingest: Callable[[str, datetime, dict], Awaitable[None]]):
        self.ingest = ingest
        self.stop_event = asyncio.Event()

    @property
    def configured(self) -> bool:
        return all(os.getenv(key) for key in ("THINGSBOARD_BASE_URL", "THINGSBOARD_WS_URL", "THINGSBOARD_USERNAME", "THINGSBOARD_PASSWORD"))

    async def run(self) -> None:
        if not self.configured:
            logger.warning("ThingsBoard bridge disabled: credentials are not configured")
            return
        delay = 1
        while not self.stop_event.is_set():
            try:
                await self._subscribe()
                delay = 1
            except asyncio.CancelledError:
                raise
            except Exception:
                logger.exception("ThingsBoard subscription failed; retrying in %ss", delay)
                await asyncio.sleep(delay)
                delay = min(delay * 2, 30)

    async def _subscribe(self) -> None:
        import websockets

        client = ThingsBoardClient(os.environ["THINGSBOARD_BASE_URL"], os.environ["THINGSBOARD_USERNAME"], os.environ["THINGSBOARD_PASSWORD"])
        token = await asyncio.to_thread(client.login)
        devices = await asyncio.to_thread(client.devices)
        station_devices = {device.id: name for name, device in devices.items() if name.startswith("sta-")}
        url = os.environ["THINGSBOARD_WS_URL"].rstrip("?") + "?token=" + quote(token)
        async with websockets.connect(url, ping_interval=20, ping_timeout=20) as websocket:
            commands = [{"entityType": "DEVICE", "entityId": device_id, "scope": "LATEST_TELEMETRY", "cmdId": index + 1, "keys": TELEMETRY_KEYS} for index, device_id in enumerate(station_devices)]
            by_command = {index + 1: station_devices[device_id] for index, device_id in enumerate(station_devices)}
            await websocket.send(json.dumps({"tsSubCmds": commands, "historyCmds": [], "attrSubCmds": []}))
            async for raw in websocket:
                message = json.loads(raw)
                station_id = by_command.get(message.get("subscriptionId"))
                parsed = telemetry_values(message.get("data", {}))
                if station_id and parsed:
                    ts, values = parsed
                    await self.ingest(station_id, datetime.fromtimestamp(ts / 1000, timezone.utc), values)

    def stop(self) -> None:
        self.stop_event.set()
