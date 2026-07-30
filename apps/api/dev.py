"""Run the API from a source checkout with local packages and `.env` loaded."""

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]
sys.path[:0] = [str(ROOT), str(ROOT / "packages/aqi-core/src"), str(ROOT / "packages/schemas/src"), str(ROOT / "apps/api")]


def load_env() -> None:
    path = ROOT / ".env"
    if not path.exists():
        return
    for line in path.read_text(encoding="utf-8").splitlines():
        if line and not line.lstrip().startswith("#") and "=" in line:
            key, value = line.split("=", 1)
            os.environ.setdefault(key.strip(), value.strip())
    os.environ["STATION_REGISTRY"] = str(ROOT / "config/stations.yaml")


if __name__ == "__main__":
    import uvicorn
    load_env()
    port = int(os.getenv("API_DEV_PORT", "8010"))
    reload_enabled = os.getenv("API_RELOAD", "true").lower() == "true"
    uvicorn.run("app.main:app", app_dir=str(ROOT / "apps/api"), host="127.0.0.1", port=port, reload=reload_enabled)
