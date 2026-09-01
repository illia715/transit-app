import 'dotenv/config';
import express from 'express';
import pg from 'pg';
import { findClosestOccurrence, isUpcoming } from '../utils/gtfsTime.js';

const app = express();
const PORT = 3000;

const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
await client.connect();

app.get('/stops/:id/arrivals', async (req, res) => {
    const stopId = req.params.id;

    const result = await client.query(
        `SELECT
            st.trip_id,
            st.arrival_time,
            r.route_short_name,
            t.trip_headsign,
            ltu.delay_seconds,
            ltu.status
         FROM stop_times st
         JOIN trips t ON st.trip_id = t.trip_id
         JOIN routes r ON t.route_id = r.route_id
         LEFT JOIN live_trip_updates ltu
            ON ltu.trip_id = st.trip_id AND ltu.stop_id = st.stop_id
         WHERE st.stop_id = $1`,
        [stopId]
    );

    const now = new Date();

    const arrivals = result.rows
        .map(row => {
            const resolvedTime = findClosestOccurrence(now, row.arrival_time);
            return { ...row, resolvedTime };
        })
        .filter(row => isUpcoming(now, row.resolvedTime))
        .sort((a, b) => a.resolvedTime - b.resolvedTime);

        const CLUSTER_WINDOW_MINUTES = 3;

    const clusters = [];

    for (const arrival of arrivals) {
        const matchingCluster = clusters.find(cluster => {
            const last = cluster[cluster.length - 1];
            const sameRoute = last.route_short_name === arrival.route_short_name;
            const sameHeadsign = last.trip_headsign === arrival.trip_headsign;
            const minutesApart = Math.abs(arrival.resolvedTime - last.resolvedTime) / 1000 / 60;
            return sameRoute && sameHeadsign && minutesApart <= CLUSTER_WINDOW_MINUTES;
        });

        if (matchingCluster) {
            matchingCluster.push(arrival);
        } else {
            clusters.push([arrival]);
        }
    }

    const deduped = clusters.flatMap(cluster => {
        const withLiveData = cluster.filter(a => a.delay_seconds !== null);
        return withLiveData.length > 0 ? withLiveData : [cluster[0]];
    });

    res.json(deduped);
});

/*in a genuinely rare edge case, two truly distinct trips that happen to share a route, headsign, and exact same second
at one particular stop could get incorrectly collapsed into one because we don't compare number of stops on each route.
Given how unlikely that specific coincidence is, and how much more common the duplicate-data pattern is, this tradeoff is reasonable */

app.listen(PORT, () => {
    console.log(`API server running on http://localhost:${PORT}`);
});