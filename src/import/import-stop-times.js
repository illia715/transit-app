import 'dotenv/config';
import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';

const BATCH_SIZE = 2000;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const parser = fs
    .createReadStream('data/gtfs_static/stop_times.txt')
    .pipe(parse({ columns: true }));

let batch = [];
let count = 0;

async function insertBatch(rows) {
    if (rows.length === 0) return;

    const values = [];
    const placeholders = rows.map((row, i) => {
        const base = i * 5;
        values.push(
            row.trip_id,
            row.stop_id,
            parseInt(row.stop_sequence, 10),
            row.arrival_time,
            row.departure_time
        );
        return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4}, $${base + 5})`;
    });

    await client.query(
        `INSERT INTO stop_times (trip_id, stop_id, stop_sequence, arrival_time, departure_time)
         VALUES ${placeholders.join(', ')}
         ON CONFLICT (trip_id, stop_sequence) DO NOTHING`,
        values
    );
}

for await (const row of parser) {
    batch.push(row);
    count++;

    if (batch.length >= BATCH_SIZE) {
        await insertBatch(batch);
        batch = [];
        if (count % 100000 === 0) {
            console.log(`Imported ${count} stop times so far...`);
        }
    }
}

await insertBatch(batch);

console.log(`Done. Total stop times imported: ${count}`);
await client.end();