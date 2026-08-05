import json
import os
import time
from datetime import datetime, timezone
from pathlib import Path

import yaml

from .model import SignalModel


def load_stations(path: str) -> list[dict]:
    return yaml.safe_load(Path(path).read_text(encoding="utf-8"))["stations"]


def main() -> None:
    from paho.mqtt import client as mqtt

    if os.getenv("DATA_MODE", "demo").lower() == "live" and os.getenv("FORCE_SIMULATION", "false").lower() != "true":
        raise SystemExit(
            "Refusing to start: DATA_MODE=live means real stations are publishing to these "
            "same device tokens. Running the simulator now would interleave synthetic and "
            "real readings under the same devices with no way to tell them apart downstream. "
            "Set FORCE_SIMULATION=true only if you have deliberately pointed this at a "
            "non-production ThingsBoard tenant."
        )

    registry = os.getenv("STATION_REGISTRY", "/app/config/stations.yaml")
    host = os.getenv("MQTT_HOST", "thingsboard")
    port = int(os.getenv("MQTT_PORT", "1883"))
    use_tls = os.getenv("MQTT_TLS", "false").lower() == "true"
    interval = float(os.getenv("PUBLISH_INTERVAL_SECONDS", "300"))
    run_once = os.getenv("SIMULATION_ONCE", "false").lower() == "true"
    model = SignalModel(int(os.getenv("SIMULATION_SEED", "42")), os.getenv("FAULT_INJECTION", "true").lower() == "true")
    stations = load_stations(registry)
    while True:
        for station in stations:
            reading = model.generate(station, datetime.now(timezone.utc))
            if reading is None:
                continue
            token = os.getenv(f"TB_TOKEN_{station['id'].upper().replace('-', '_')}", os.getenv("TB_DEVICE_TOKEN", ""))
            if not token:
                print(json.dumps({"station_id": station["id"], "values": reading}), flush=True)
                continue
            client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)
            client.username_pw_set(token)
            if use_tls:
                client.tls_set()
                client.tls_insecure_set(os.getenv("MQTT_TLS_INSECURE", "false").lower() == "true")
            client.connect(host, port, 30)
            client.loop_start()
            payload = {"ts": int(time.time() * 1000), "values": reading}
            result = client.publish("v1/devices/me/telemetry", json.dumps(payload), qos=1)
            result.wait_for_publish(timeout=10)
            if not result.is_published():
                raise TimeoutError(f"MQTT acknowledgement timed out for {station['id']}")
            client.disconnect()
            client.loop_stop()
        if run_once:
            break
        time.sleep(interval)


if __name__ == "__main__":
    main()
