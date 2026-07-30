from datetime import datetime
from enum import StrEnum
from pydantic import BaseModel, Field


class SourceType(StrEnum):
    OWN_SENSOR = "OWN_SENSOR"
    PUBLIC_CEA = "PUBLIC_CEA"
    PUBLIC_NBRO = "PUBLIC_NBRO"
    PUBLIC_WAQI = "PUBLIC_WAQI"
    PUBLIC_AQIIN = "PUBLIC_AQIIN"
    SIMULATED = "SIMULATED"


class Measurement(BaseModel):
    value: float
    unit: str


class Provenance(BaseModel):
    source_type: SourceType
    source_name: str
    calibration_state: str
    confidence: str
    aggregation: str


class Station(BaseModel):
    id: str
    name: str
    name_si: str | None = None
    name_ta: str | None = None
    lat: float
    lng: float
    site_class: str
    corridor: str | None = None
    district: str
    operator: str
    parameters: list[str]
    status: str


class CanonicalReading(BaseModel):
    reading_id: str
    station_id: str
    timestamp_utc: datetime
    measurements: dict[str, Measurement | None]
    meteorology: dict[str, float | None]
    indices: dict
    provenance: Provenance
    raw: dict[str, float | None] = Field(description="Immutable received sensor values")

