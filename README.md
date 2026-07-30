# aqi.thingsnode

An open-source, child-health-focused air-quality platform for Sri Lanka. The MVP is
designed to run in honest demo mode until physical stations are commissioned.

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
uvicorn app.main:app --app-dir apps/api --reload
npm run dev --workspace apps/web
```

The web app uses `/api/v1` and Vite proxies it to port 8000. It does not contain
mocked JSON. With no incoming station reading it shows a clearly bounded empty/demo
state while retaining the production API path.

For the container stack, copy `.env.example` to `.env`, replace passwords, add the
server-side account for `https://demo.thingsboard.cc`, and provision a ThingsBoard
device access token for each station. Then run against the existing instance:

```sh
docker compose -f infra/docker-compose.yml --profile simulation up --build
```

Open `http://localhost:3000/app/`. To run an isolated local ThingsBoard instead, add
`--profile local-thingsboard` and change the ThingsBoard/MQTT hosts in `.env`.

The ThingsBoard account needs permission to list/read the 15 demo devices and
subscribe to their latest telemetry. It does not need system-administrator access.

## Licensing

Code is Apache 2.0. Published project-generated datasets are intended for CC BY 4.0;
third-party source data retains its original terms and attribution requirements.
