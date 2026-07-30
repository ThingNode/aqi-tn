"""Small ThingsBoard REST client used for provisioning and subscription discovery."""

import json
from dataclasses import dataclass
from urllib.error import HTTPError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


class ThingsBoardError(RuntimeError):
    pass


@dataclass(frozen=True)
class Device:
    id: str
    name: str


class ThingsBoardClient:
    def __init__(self, base_url: str, username: str, password: str, timeout: float = 20):
        self.base_url = base_url.rstrip("/")
        self.username = username
        self.password = password
        self.timeout = timeout
        self.token: str | None = None

    def _request(self, method: str, path: str, body: dict | None = None) -> dict:
        headers = {"Content-Type": "application/json"}
        if self.token:
            headers["X-Authorization"] = f"Bearer {self.token}"
        request = Request(
            self.base_url + path,
            data=json.dumps(body).encode() if body is not None else None,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=self.timeout) as response:
                return json.load(response)
        except HTTPError as error:
            try:
                detail = json.load(error).get("message", error.reason)
            except Exception:
                detail = error.reason
            raise ThingsBoardError(f"ThingsBoard HTTP {error.code}: {detail}") from error

    def login(self) -> str:
        result = self._request("POST", "/api/auth/login", {"username": self.username, "password": self.password})
        self.token = result["token"]
        return self.token

    def devices(self) -> dict[str, Device]:
        if not self.token:
            self.login()
        page = 0
        found: dict[str, Device] = {}
        while True:
            query = urlencode({"pageSize": 100, "page": page})
            payload = self._request("GET", f"/api/tenant/devices?{query}")
            for item in payload.get("data", []):
                found[item["name"]] = Device(id=item["id"]["id"], name=item["name"])
            if not payload.get("hasNext", False):
                return found
            page += 1

    def create_device(self, name: str, label: str) -> Device:
        payload = self._request("POST", "/api/device", {"name": name, "type": "aqi-station", "label": label})
        return Device(id=payload["id"]["id"], name=payload["name"])

    def access_token(self, device_id: str) -> str:
        payload = self._request("GET", f"/api/device/{device_id}/credentials")
        if payload.get("credentialsType") != "ACCESS_TOKEN":
            raise ThingsBoardError(f"device {device_id} does not use access-token credentials")
        return payload["credentialsId"]

    def reconcile(self, stations: list[dict], *, create: bool = False) -> tuple[dict[str, Device], list[str]]:
        existing = self.devices()
        matched: dict[str, Device] = {}
        missing: list[str] = []
        for station in stations:
            name = station["id"]
            if name in existing:
                matched[name] = existing[name]
            elif create:
                matched[name] = self.create_device(name, station["name"])
            else:
                missing.append(name)
        return matched, missing
