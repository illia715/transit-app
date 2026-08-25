CREATE TABLE stops (
    stop_id TEXT PRIMARY KEY,
    stop_name TEXT NOT NULL,
    stop_lat DOUBLE PRECISION NOT NULL,
    stop_lon DOUBLE PRECISION NOT NULL,
    is_dublin_area BOOLEAN DEFAULT FALSE
);

CREATE TABLE routes (
    route_id TEXT PRIMARY KEY,
    route_short_name TEXT,
    route_long_name TEXT,
    agency_id TEXT
);

CREATE TABLE trips (
    trip_id TEXT PRIMARY KEY,
    route_id TEXT REFERENCES routes(route_id),
    shape_id TEXT,
    direction_id INTEGER,
    trip_headsign TEXT
);

CREATE TABLE stop_times (
    trip_id TEXT REFERENCES trips(trip_id),
    stop_id TEXT REFERENCES stops(stop_id),
    stop_sequence INTEGER,
    arrival_time TEXT,
    departure_time TEXT,
    PRIMARY KEY (trip_id, stop_sequence)
);

CREATE TABLE shapes (
    shape_id TEXT,
    shape_pt_sequence INTEGER,
    shape_pt_lat DOUBLE PRECISION,
    shape_pt_lon DOUBLE PRECISION,
    PRIMARY KEY (shape_id, shape_pt_sequence)
);

CREATE INDEX idx_stop_times_stop_id ON stop_times(stop_id);
CREATE INDEX idx_stop_times_trip_id ON stop_times(trip_id);
CREATE INDEX idx_trips_route_id ON trips(route_id);