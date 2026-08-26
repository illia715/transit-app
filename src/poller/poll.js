import 'dotenv/config';
import fetch from 'node-fetch';
import pg from 'pg';

const API_KEY = process.env.NTA_API_KEY;
const BASE_URL = 'https://api.nationaltransport.ie/gtfsr/v2';
const POLL_INTERVAL_MS = 60000; // 60 seconds

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

async function fetchFeed(path) {
    const res = await fetch(`${BASE_URL}/${path}?format=json`, {
        headers: { 'x-api-key': API_KEY }
    });
    if (!res.ok) {
        throw new Error(`${path} request failed: ${res.status} ${res.statusText}`);
    }
    return res.json();
}

function mapStatus(scheduleRelationship) {
    if (scheduleRelationship === 'CANCELED') return 'cancelled';
    if (scheduleRelationship === 'ADDED') return 'added';
    return 'scheduled';
}

async function pollOnce() {
    console.log(`[${new Date().toLocaleDateString('en-IE')} | ${new Date().toLocaleTimeString('en-IE')}] Polling...`);
    const [tripUpdates, vehicles] = await Promise.all([
        fetchFeed('TripUpdates'),
        fetchFeed('Vehicles')
    ]);

    // --- Process TripUpdates ---
    let tripUpdateCount = 0;

    for (const entity of tripUpdates.entity) {
        const trip = entity.trip_update?.trip;
        if (!trip?.trip_id) continue; // skip ADDED trips with no trip_id, for now

        const status = mapStatus(trip.schedule_relationship);
        const stopUpdates = entity.trip_update.stop_time_update ?? [];
        const vehicleId = entity.trip_update.vehicle?.id ?? null;

        for (const stopUpdate of stopUpdates) {
            const delaySeconds = stopUpdate.arrival?.delay ?? stopUpdate.departure?.delay ?? 0;

            await client.query(
                `INSERT INTO live_trip_updates (trip_id, stop_id, route_id, delay_seconds, status, vehicle_id, updated_at)
                 VALUES ($1, $2, $3, $4, $5, $6, now())
                 ON CONFLICT (trip_id, stop_id)
                 DO UPDATE SET delay_seconds = $4, status = $5, vehicle_id = $6, updated_at = now()`,
                [trip.trip_id, stopUpdate.stop_id, trip.route_id, delaySeconds, status, vehicleId]
            );

            await client.query(
                `INSERT INTO delay_log (trip_id, route_id, stop_id, delay_seconds, status)
                 VALUES ($1, $2, $3, $4, $5)`,
                [trip.trip_id, trip.route_id, stopUpdate.stop_id, delaySeconds, status]
            );

            tripUpdateCount++;
        }
    }

    // --- Process Vehicles ---
    let vehicleCount = 0;

    for (const entity of vehicles.entity) {
        const vehicleId = entity.vehicle?.vehicle?.id;
        const position = entity.vehicle?.position;
        if (!vehicleId || !position) continue;

        await client.query(
            `INSERT INTO live_vehicle_positions (vehicle_id, trip_id, route_id, latitude, longitude, bearing, updated_at)
             VALUES ($1, $2, $3, $4, $5, $6, now())
             ON CONFLICT (vehicle_id)
             DO UPDATE SET trip_id = $2, route_id = $3, latitude = $4, longitude = $5, bearing = $6, updated_at = now()`,
            [
                vehicleId,
                entity.vehicle.trip?.trip_id ?? null,
                entity.vehicle.trip?.route_id ?? null,
                position.latitude,
                position.longitude,
                position.bearing ?? null
            ]
        );

        vehicleCount++;
    }

    console.log(`    -> ${tripUpdateCount} trip updates, ${vehicleCount} vehicle positions written.`);
}

async function runForever() {
    while (true) {
        try {
            await pollOnce();
        } catch (err) {
            console.error('Poll failed:', err.message);
            // catch doesn't crash the whole poller over one failed poll; it logs it and keeps going
        }
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));
    }
}

runForever();