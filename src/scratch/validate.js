import 'dotenv/config';
import fetch from 'node-fetch';

const API_KEY = process.env.NTA_API_KEY;
const BASE_URL = 'https://api.nationaltransport.ie/gtfsr/v2';

async function fetchFeed(path) {
  const res = await fetch(`${BASE_URL}/${path}?format=json`, {
    headers: { 'x-api-key': API_KEY }
  });
  if (!res.ok) {
    throw new Error(`${path} request failed: ${res.status} ${res.statusText}`);
  }
  return res.json();
}

const [tripUpdates, vehicles] = await Promise.all([
  fetchFeed('TripUpdates'),
  fetchFeed('Vehicles')
]);

// Build a lookup: trip_id -> vehicle position
const positionByTripId = new Map();
for (const entity of vehicles.entity) {
  const tripId = entity.vehicle?.trip?.trip_id;
  const position = entity.vehicle?.position;
  if (tripId && position) {
    positionByTripId.set(tripId, position);
  }
}

// Join trip updates with positions, print the first 10
let printed = 0;
for (const entity of tripUpdates.entity) {
  if (printed >= 10) break;

  const trip = entity.trip_update?.trip;
  if (!trip?.trip_id) continue; // skip ADDED trips with no trip_id for now

  const stopUpdate = entity.trip_update.stop_time_update?.[0];
  const delaySeconds = stopUpdate?.arrival?.delay ?? 0;
  const delayMinutes = Math.round(delaySeconds / 60);
  const position = positionByTripId.get(trip.trip_id);

  console.log(
    `Route ${trip.route_id} (trip ${trip.trip_id}): ${delayMinutes} min ${delayMinutes >= 0 ? 'late' : 'early'}` +
    (position ? ` — vehicle at ${position.latitude}, ${position.longitude}` : ' — no live position')
  );

  printed++;
}