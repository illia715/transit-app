import {
    gtfsTimeToDate,
    findClosestOccurrence,
    isUpcoming
} from '../utils/gtfsTime.js';

const now = new Date('2026-08-25T18:50:00');

const testCases = [
    { label: 'Normal daytime arrival', gtfsTime: '19:05:00' },
    { label: 'Late-night rollover', gtfsTime: '25:15:00' },
    { label: 'Early-morning (or really late night) time', gtfsTime: '01:15:00' },
    { label: 'Just passed', gtfsTime: '18:45:00' }
];

for (const test of testCases) {
    const resolved = findClosestOccurrence(now, test.gtfsTime);
    const upcoming = isUpcoming(now, resolved);

    console.log(`${test.label} ("${test.gtfsTime}")`);
    console.log(`  resolved to: ${resolved.toLocaleString('en-IE')}`);
    console.log(`  is upcoming: ${upcoming}`);
    console.log('');
}