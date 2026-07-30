CREATE EXTENSION IF NOT EXISTS timescaledb;
CREATE TABLE IF NOT EXISTS readings (
  reading_id uuid PRIMARY KEY,
  station_id text NOT NULL,
  timestamp_utc timestamptz NOT NULL,
  measurements jsonb NOT NULL,
  meteorology jsonb NOT NULL,
  indices jsonb NOT NULL,
  provenance jsonb NOT NULL,
  raw jsonb NOT NULL,
  CONSTRAINT provenance_required CHECK (provenance ?& ARRAY['source_type','source_name','calibration_state','confidence','aggregation'])
);
SELECT create_hypertable('readings', by_range('timestamp_utc'), if_not_exists => TRUE);
CREATE INDEX IF NOT EXISTS readings_station_time ON readings (station_id, timestamp_utc DESC);

