import 'dotenv/config';
import fs from 'fs';
import { parse } from 'csv-parse';
import pg from 'pg';

const BATCH_SIZE = 1000;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

const parser = fs
  .createReadStream('data/gtfs_static/shapes.txt')
  .pipe(parse({ columns: true }));

let batch = [];
let count = 0;

async function insertBatch(rows) {
  if (rows.length === 0) return;

  const values = [];
  const placeholders = rows.map((row, i) => {
  const base = i * 4;
  values.push(
    row.shape_id,
    parseInt(row.shape_pt_sequence, 10),
    parseFloat(row.shape_pt_lat),
    parseFloat(row.shape_pt_lon)
  );
  return `($${base + 1}, $${base + 2}, $${base + 3}, $${base + 4})`;
  });

  await client.query(
  `INSERT INTO shapes (shape_id, shape_pt_sequence, shape_pt_lat, shape_pt_lon)
   VALUES ${placeholders.join(', ')}
   ON CONFLICT (shape_id, shape_pt_sequence) DO NOTHING`,
  values
  );
}

for await (const row of parser) {
  batch.push(row);
  count++;

  if (batch.length >= BATCH_SIZE) {
  await insertBatch(batch);
  batch = [];
  console.log(`Imported ${count} shape points so far...`);
  }
}

// insert any remaining rows that didn't fill a full batch
await insertBatch(batch);

console.log(`Done. Total shape points imported: ${count}`);
await client.end();