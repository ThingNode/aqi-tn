"""Reconcile the station registry with a ThingsBoard tenant.

Tokens are written to a gitignored file, never stdout. Run with ``--create`` only
after reviewing the read-only report.
"""

import argparse
import os
from pathlib import Path

import yaml

from .client import ThingsBoardClient


def normalized(station_id: str) -> str:
    return "TB_TOKEN_" + station_id.upper().replace("-", "_")


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--registry", default="config/stations.yaml")
    parser.add_argument("--create", action="store_true")
    parser.add_argument("--tokens-file", default="thingsboard-device-tokens.env")
    args = parser.parse_args()
    required = ("THINGSBOARD_BASE_URL", "THINGSBOARD_USERNAME", "THINGSBOARD_PASSWORD")
    missing_env = [key for key in required if not os.getenv(key)]
    if missing_env:
        raise SystemExit("missing environment variables: " + ", ".join(missing_env))
    stations = yaml.safe_load(Path(args.registry).read_text(encoding="utf-8"))["stations"]
    client = ThingsBoardClient(*(os.environ[key] for key in required))
    devices, missing = client.reconcile(stations, create=args.create)
    print(f"matched={len(devices)} missing={len(missing)}")
    for station_id in missing:
        print(f"missing: {station_id}")
    if args.create:
        lines = [f"{normalized(name)}={client.access_token(device.id)}" for name, device in sorted(devices.items())]
        Path(args.tokens_file).write_text("\n".join(lines) + "\n", encoding="utf-8")
        print(f"tokens_written={args.tokens_file}")


if __name__ == "__main__":
    main()
