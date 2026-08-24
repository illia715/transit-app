import 'dotenv/config';
import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const parser = fs
  .createReadStream('data/gtfs_static/routes.txt')
  .pipe(parse({ columns: true }));

let count = 0;

for await (const row of parser) {
  await client.query(
    `INSERT INTO routes (route_id, route_short_name, route_long_name, agency_id)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (route_id) DO NOTHING`,
    [row.route_id, row.route_short_name, row.route_long_name, row.agency_id]
  );

  count++;
  if (count % 500 === 0) {
    console.log(`Imported ${count} routes so far...`);
  }
}

console.log(`Done. Total routes imported: ${count}`);
await client.end();