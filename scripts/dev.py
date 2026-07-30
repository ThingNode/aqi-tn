"""Start the API and Vite app together for local development."""

import subprocess
import sys
import time
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]


def main() -> None:
    api = subprocess.Popen([sys.executable, str(ROOT / "apps/api/dev.py")], cwd=ROOT)
    npm = "npm.cmd" if sys.platform == "win32" else "npm"
    web = subprocess.Popen([npm, "run", "dev:web"], cwd=ROOT)
    try:
        while api.poll() is None and web.poll() is None:
            time.sleep(0.5)
    except KeyboardInterrupt:
        pass
    finally:
        for process in (web, api):
            if process.poll() is None:
                process.terminate()
        for process in (web, api):
            try:
                process.wait(timeout=8)
            except subprocess.TimeoutExpired:
                process.kill()
    raise SystemExit(api.returncode or web.returncode or 0)


if __name__ == "__main__":
    main()
