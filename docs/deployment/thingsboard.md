# Existing ThingsBoard setup

Target instance: `https://demo.thingsnode.cc`. The initially supplied
`demo.thingsboard.cc` hostname did not have a DNS record; authentication confirmed
the ThingsNode hostname is the intended tenant.

Create a dedicated tenant-level service account with only the permissions needed to
list devices and read telemetry. Put its username and password in the deployment
secret store as `THINGSBOARD_USERNAME` and `THINGSBOARD_PASSWORD`; never prefix these
variables with `VITE_` or expose them to the browser.

Create one ThingsBoard device for each ID in `config/stations.yaml`. Use the station
ID as the device name so registry matching is deterministic. Assign each access
token to its corresponding `TB_TOKEN_<NORMALIZED_STATION_ID>` variable. The simulator
uses these tokens to publish raw telemetry; the API account uses the server-side
WebSocket to consume it.

Confirm whether MQTT is exposed as plaintext `1883` or TLS `8883`. Set `MQTT_TLS`
accordingly. `MQTT_TLS_INSECURE` must remain false outside a temporary certificate
diagnostic.

Required server account capabilities:

- authenticate through `/api/auth/login`;
- list tenant devices;
- resolve device IDs from station names;
- read and subscribe to device telemetry.

No ThingsBoard rule-chain calculations are required. Calibration, index calculation,
provenance, persistence, and browser fan-out remain in the application API.

## Reconcile devices

Load `.env` into the shell, then perform a read-only report:

```sh
python -m services.thingsboard.provision
```

After reviewing missing devices, create only those registry entries and save their
access tokens to the gitignored `thingsboard-device-tokens.env` file:

```sh
python -m services.thingsboard.provision --create
```
