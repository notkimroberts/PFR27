#!/usr/bin/env bun
/**
 * Brazilian Room Availability Checker
 * East Bay Regional Park District
 *
 * Checks every Saturday in June, July, and August 2027.
 * Run every 10 minutes via cron. Sends a macOS desktop notification
 * and an ntfy.sh push notification when any target date is available.
 */

// ── Config ────────────────────────────────────────────────────────────────────

const RESOURCE_ID = 150
const RESOURCE_NAME = 'Brazilian Room'

// ntfy.sh topic — change this to your own unique topic name.
// Subscribe to it in the ntfy app on your phone.
const NTFY_TOPIC = 'brazilian-room-pfr'

// June–August 2027, split into chunks to stay within the 44-day API limit
// (91 days total: Jun 1 – Aug 31)
const DATE_RANGES: [string, string][] = [
    ['2027-06-01', '2027-07-14'],
    ['2027-07-15', '2027-08-27'],
    ['2027-08-28', '2027-08-31'],
]

const API_BASE =
    `https://anc.apm.activecommunities.com/ebparks/rest/reservation/resource` +
    `/availability/daily/${RESOURCE_ID}`

// status values observed in the API
const STATUS_AVAILABLE = 0

// ── Logging ───────────────────────────────────────────────────────────────────

function log(level: string, message: string): void {
    const ts = new Date().toISOString().replace('T', '  ').replace(/\..+$/, '')
    const line = `${ts}  ${level.padEnd(8)}  ${message}\n`
    process.stdout.write(line)
}

const logger = {
    info: (msg: string) => log('INFO', msg),
    warn: (msg: string) => log('WARNING', msg),
    error: (msg: string) => log('ERROR', msg),
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function isSaturday(dateStr: string): boolean {
    // dateStr is YYYY-MM-DD; append T12:00:00 to avoid UTC offset shifting the day
    return new Date(`${dateStr}T12:00:00`).getDay() === 6
}

function formatLabel(dateStr: string): string {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'America/Los_Angeles',
    })
}

function formatShort(dateStr: string): string {
    return new Date(`${dateStr}T12:00:00`).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        timeZone: 'America/Los_Angeles',
    })
}

function sendNotification(title: string, message: string): void {
    const script = `display notification "${message}" with title "${title}" sound name "Glass"`
    const result = Bun.spawnSync(['osascript', '-e', script])
    if (result.exitCode !== 0) {
        logger.error(`Desktop notification failed (exit code ${result.exitCode})`)
    } else {
        logger.info('Desktop notification sent.')
    }
}

async function sendNtfy(title: string, message: string): Promise<void> {
    const resp = await fetch(`https://ntfy.sh/${NTFY_TOPIC}`, {
        method: 'POST',
        headers: {
            Title: title,
            Priority: 'high',
            Tags: 'calendar',
        },
        body: message,
    })
    if (!resp.ok) {
        logger.error(`ntfy notification failed (HTTP ${resp.status})`)
    } else {
        logger.info('ntfy notification sent.')
    }
}

// ── Core check ────────────────────────────────────────────────────────────────

type DailyDetail = { date: string; status: number; times: unknown[] }

async function fetchRange(startDate: string, endDate: string): Promise<DailyDetail[]> {
    const url =
        `${API_BASE}?start_date=${startDate}&end_date=${endDate}` +
        `&customer_id=0&company_id=0&locale=en-US`

    const resp = await fetch(url, {
        headers: {
            'User-Agent':
                'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) ' +
                'AppleWebKit/537.36 (KHTML, like Gecko) ' +
                'Chrome/120.0.0.0 Safari/537.36',
            Accept: 'application/json',
        },
    })

    if (!resp.ok) {
        throw new Error(`API returned HTTP ${resp.status} for range ${startDate}–${endDate}`)
    }

    const data = await resp.json()

    if (data?.headers?.response_code !== '0000') {
        throw new Error(
            `API error for range ${startDate}–${endDate}: ${data?.headers?.response_message}`,
        )
    }

    return data?.body?.details?.daily_details ?? []
}

async function checkAvailability(): Promise<string[]> {
    const allDetails: DailyDetail[] = []

    for (const [start, end] of DATE_RANGES) {
        const details = await fetchRange(start, end)
        allDetails.push(...details)
    }

    if (allDetails.length === 0) {
        logger.warn('API returned no daily_details — response may have changed.')
    }

    const available: string[] = []

    for (const entry of allDetails) {
        if (!isSaturday(entry.date)) continue

        const label = formatLabel(entry.date)
        if (entry.status === STATUS_AVAILABLE && entry.times.length > 0) {
            logger.info(`  AVAILABLE on ${label}`)
            available.push(entry.date)
        } else {
            logger.info(`  Not available on ${label}`)
        }
    }

    return available
}

async function main(): Promise<void> {
    logger.info(`=== ${RESOURCE_NAME} availability check starting ===`)

    const available = await checkAvailability()

    if (available.length > 0) {
        const summary = available.map(formatShort).join(' | ')
        const detail = available.map((d) => `  • ${formatLabel(d)}`).join('\n')
        logger.info(`AVAILABLE DATES FOUND:\n${detail}`)
        sendNotification(`${RESOURCE_NAME} AVAILABLE!`, `Open on: ${summary}`)
        await sendNtfy(`${RESOURCE_NAME} AVAILABLE!`, `Open on: ${summary}`)
    } else {
        await sendNtfy(
            `${RESOURCE_NAME} NOT AVAILABLE!`,
            `No availability found for any target Saturday.`,
        )
        logger.info('No availability found for any target Saturday.')
    }

    logger.info('=== Check complete ===\n')
}

main().catch((err: Error) => {
    logger.error(`Fatal: ${err.message}`)
    process.exit(1)
})
