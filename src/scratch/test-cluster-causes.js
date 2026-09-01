import 'dotenv/config';
import fetch from 'node-fetch';
import pg from 'pg';

const API_KEY = process.env.NTA_API_KEY;
const BASE_URL = 'https://api.nationaltransport.ie/gtfsr/v2';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const tripIds = ['5855_131930', '5855_131936', '5855_131933'];

// ---------- Check 0: route_long_name disambiguation ----------
console.log('--- Check 0: route names ---');

const routeResult = await client.query(
    `SELECT t.trip_id, t.route_id, r.route_short_name, r.route_long_name
     FROM trips t JOIN routes r ON t.route_id = r.route_id
     WHERE t.trip_id = ANY($1)`,
    [tripIds]
);
console.table(routeResult.rows);

// ---------- Check 1: does the LIVE feed itself report all three trip_ids right now? ----------
console.log('\n--- Check 1: live feed presence (fresh fetch) ---');

async function fetchFeed(path) {
    const res = await fetch(`${BASE_URL}/${path}?format=json`, {
        headers: { 'x-api-key': API_KEY }
    });
    if (!res.ok) {
        throw new Error(`${path} request failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

const tripUpdates = await fetchFeed('TripUpdates');
const vehicles = await fetchFeed('Vehicles');

for (const tripId of tripIds) {
    const foundInTripUpdates = tripUpdates.entity.some(
        e => e.trip_update?.trip?.trip_id === tripId
    );
    const vehicleEntity = vehicles.entity.find(
        e => e.vehicle?.trip?.trip_id === tripId
    );

    console.log(`  ${tripId}:`);
    console.log(`    in live TripUpdates right now: ${foundInTripUpdates}`);
    console.log(`    in live Vehicles right now: ${vehicleEntity ? 'yes' : 'no'}`);
    if (vehicleEntity) {
        console.log(`    vehicle_id: ${vehicleEntity.vehicle.vehicle?.id}, position: ${vehicleEntity.vehicle.position?.latitude}, ${vehicleEntity.vehicle.position?.longitude}`);
    }
}

// ---------- Check 2: position plausibility using this FRESH data, not stale stored data ----------
console.log('\n--- Check 2: position plausibility (using fresh feed data) ---');

function haversineKm(lat1, lon1, lat2, lon2) {
    const R = 6371;
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
        Math.sin(dLon / 2) ** 2;
    return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

for (const tripId of tripIds) {
    const firstStop = await client.query(
        `SELECT s.stop_lat, s.stop_lon
         FROM stop_times st JOIN stops s ON st.stop_id = s.stop_id
         WHERE st.trip_id = $1 AND st.stop_sequence = 1`,
        [tripId]
    );

    const vehicleEntity = vehicles.entity.find(
        e => e.vehicle?.trip?.trip_id === tripId
    );

    if (firstStop.rows.length === 0 || !vehicleEntity?.vehicle?.position) {
        console.log(`  ${tripId}: no first-stop or no fresh live position, skipping`);
        continue;
    }

    const { stop_lat, stop_lon } = firstStop.rows[0];
    const { latitude, longitude } = vehicleEntity.vehicle.position;

    const distanceKm = haversineKm(stop_lat, stop_lon, latitude, longitude);
    console.log(`  ${tripId}: ${distanceKm.toFixed(1)} km from its own trip's first stop (fresh position)`);
}

await client.end();