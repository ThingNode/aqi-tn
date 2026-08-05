# aqi.thingsnode

An open-source, child-health-focused air-quality platform for Sri Lanka. All 15
registry stations are commissioned and publishing live telemetry; the platform
runs in `DATA_MODE=live`. The simulator remains available for local development
without hardware but must never be pointed at the production ThingsBoard
instance — see `docs/deployment/thingsboard.md`.

## Repository

- `packages/aqi-core` — canonical index functions and tests
- `packages/schemas` — canonical reading and station models
- `services/simulator` — standalone, disposable MQTT telemetry generator
- `services/calibration` — server-side raw-value correction
- `apps/api` — FastAPI REST and browser WebSocket gateway
- `apps/web` — React application derived from the supplied Claude design
- `config/stations.yaml` — shared 15-station registry
- `infra/docker-compose.yml` — ThingsBoard, databases, Redis, API, simulator and web

## Develop

Requires Python 3.12 and Node 22.

```sh
python -m pytest
npm install
npm run build --workspace apps/web
npm run dev
```

The local API listens on `http://127.0.0.1:8020`; Vite proxies `/api` and the
application WebSocket to it. Port 8020 avoids development-tool services commonly
bound to port 8000.

The web app uses `/api/v1` and Vite proxies it to port 8000. It does not contain
mocked JSON. With no incoming station reading it shows a clearly bounded empty/demo
state while retaining the production API path.

For the container stack, copy `.env.example` to `.env`, replace passwords, add the
server-side account for `https://demo.thingsnode.cc`, and provision a ThingsBoard
device access token for each station. Then run against the existing instance:

```sh
docker compose -f infra/docker-compose.yml up --build
```

Open `http://localhost:3000/app/`. To run an isolated local ThingsBoard instead, add
`--profile local-thingsboard` and change the ThingsBoard/MQTT hosts in `.env`.

**Do not add `--profile simulation` against this instance.** The 15 stations are
commissioned and live; the simulator publishes to the same per-station device
tokens and would interleave synthetic and real readings under the same devices.
It's retained only for local development without hardware, against a
non-production tenant — see `docs/deployment/thingsboard.md`.

The ThingsBoard account needs permission to list/read the 15 devices and
subscribe to their latest telemetry. It does not need system-administrator access.

## Licensing

Code is Apache 2.0. Published project-generated datasets are intended for CC BY 4.0;
third-party source data retains its original terms and attribution requirements.
See `docs/data-protection-statement.md` for what data is (and is not) collected.
