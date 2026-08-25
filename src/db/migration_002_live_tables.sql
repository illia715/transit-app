CREATE TABLE live_trip_updates (
    trip_id TEXT,
    stop_id TEXT,
    route_id TEXT,
    delay_seconds INTEGER,
    status TEXT,
    vehicle_id TEXT,
    updated_at TIMESTAMP DEFAULT now(),
    PRIMARY KEY (trip_id, stop_id)
);

CREATE TABLE live_vehicle_positions (
    vehicle_id TEXT PRIMARY KEY,
    trip_id TEXT,
    route_id TEXT,
    latitude DOUBLE PRECISION,
    longitude DOUBLE PRECISION,
    bearing INTEGER,
    updated_at TIMESTAMP DEFAULT now()
);

CREATE TABLE delay_log (
    id SERIAL PRIMARY KEY,
    trip_id TEXT,
    route_id TEXT,
    stop_id TEXT,
    delay_seconds INTEGER,
    status TEXT,
    logged_at TIMESTAMP DEFAULT now()
);

CREATE INDEX idx_delay_log_route_id ON delay_log(route_id);
CREATE INDEX idx_delay_log_stop_id ON delay_log(stop_id);
CREATE INDEX idx_live_trip_updates_route_id ON live_trip_updates(route_id);