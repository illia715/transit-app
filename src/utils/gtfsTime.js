export function gtfsTimeToDate(baseDate, gtfsTime) {
    // gtfsTime looks like "25:15:00", hours can exceed 24
    const [hours, minutes, seconds] = gtfsTime.split(':').map(Number);

    const result = new Date(baseDate);
    result.setHours(0, 0, 0, 0); // reset to midnight of baseDate
    result.setSeconds(
        hours * 3600 + minutes * 60 + seconds
    );

    return result;
}

export function findClosestOccurrence(now, gtfsTime) {
    // try "today" as the base date first
    const today = new Date(now);
    today.setHours(0, 0, 0, 0);

    const candidateToday = gtfsTimeToDate(today, gtfsTime);

    // also try "yesterday" as the base date, for late-night trips
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    const candidateYesterday = gtfsTimeToDate(yesterday, gtfsTime);

    // pick whichever candidate is closer to "now"
    const diffToday = Math.abs(candidateToday - now);
    const diffYesterday = Math.abs(candidateYesterday - now);

    return diffToday <= diffYesterday ? candidateToday : candidateYesterday;
}

export function isUpcoming(now, resolvedTime, windowMinutes = 90) {
    const diffMs = resolvedTime - now;
    const diffMinutes = diffMs / 1000 / 60;

    return diffMinutes >= -2 && diffMinutes <= windowMinutes;
}