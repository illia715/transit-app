import 'dotenv/config';
console.log('Loaded DATABASE_URL:', process.env.DATABASE_URL);
import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';

const DUBLIN_BOUNDS = {
  minLat: 53.22,
  maxLat: 53.50,
  minLon: -6.55,
  maxLon: -6.00
};

function isInDublinArea(lat, lon) {
  return (
    lat >= DUBLIN_BOUNDS.minLat &&
    lat <= DUBLIN_BOUNDS.maxLat &&
    lon >= DUBLIN_BOUNDS.minLon &&
    lon <= DUBLIN_BOUNDS.maxLon
  );
}

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const parser = fs
  .createReadStream('data/gtfs_static/stops.txt')
  .pipe(parse({ columns: true }));

let count = 0;

for await (const row of parser) {
  const lat = parseFloat(row.stop_lat);
  const lon = parseFloat(row.stop_lon);
  const dublinArea = isInDublinArea(lat, lon);

  await client.query(
    `INSERT INTO stops (stop_id, stop_name, stop_lat, stop_lon, is_dublin_area)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (stop_id) DO NOTHING`,
    [row.stop_id, row.stop_name, lat, lon, dublinArea]
  );

  count++;
  if (count % 1000 === 0) {
    console.log(`Imported ${count} stops so far...`);
  }
}

console.log(`Done. Total stops imported: ${count}`);
await client.end();