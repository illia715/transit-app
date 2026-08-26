import 'dotenv/config';
import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const parser = fs
  .createReadStream('data/gtfs_static/trips.txt')
  .pipe(parse({ columns: true }));

let count = 0;

for await (const row of parser) {
  await client.query(
    `INSERT INTO trips (trip_id, route_id, shape_id, direction_id, trip_headsign)
     VALUES ($1, $2, $3, $4, $5)
     ON CONFLICT (trip_id) DO NOTHING`,
    [
      row.trip_id,
      row.route_id,
      row.shape_id,
      row.direction_id ? parseInt(row.direction_id, 10) : null,
      row.trip_headsign
    ]
  );

  count++;
  if (count % 2000 === 0) {
    console.log(`Imported ${count} trips so far...`);
  }
}

console.log(`Done. Total trips imported: ${count}`);
await client.end();