# Brazilian Room Availability Checker

Automated availability checker for the [Brazilian Room](https://anc.apm.activecommunities.com/ebparks/reservation/landing/search/detail/150) at Tilden Regional Park (East Bay Regional Park District). Monitors Saturday availability for June, July, and August 2027 and sends macOS desktop notifications when a date opens up.

## Requirements

- macOS
- [Bun](https://bun.sh) runtime

Install Bun if you don't have it:

```sh
curl -fsSL https://bun.sh/install | bash
```

## Setup

Run the setup script once to install dependencies and register the cron job:

```sh
./setup.sh
```

This will:

1. Install dependencies
2. Add a cron job that runs the checker every 10 minutes

## Manual Run

To run the checker immediately outside of cron:

```sh
bun run check_availability.ts
```

## Notifications

The script sends a macOS desktop notification (with the "Glass" sound) when an available Saturday is found.

To ensure notifications work when triggered by cron, you may need to grant permissions:

- **System Settings → Privacy & Security → Full Disk Access** — add `cron`
- **System Settings → Notifications** — enable notifications for `Script Editor` or `Terminal`

## Logs

All output is appended to:

```sh
~/.brazilianroom_check.log
```

View logs:

```sh
tail -f ~/.brazilianroom_check.log
```

## Managing the Cron Job

View the registered cron job:

```sh
crontab -l
```

Remove all cron jobs (if you want to stop the checker):

```sh
crontab -r
```

## Configuration

To monitor different dates or a different facility, edit `check_availability.ts`:

- **Resource ID**: `RESOURCE_ID` constant at the top of the file (currently `150` for the Brazilian Room)
- **Date ranges**: `DATE_RANGES` array — split into chunks of ≤ 44 days due to an API limit
- **Check interval**: edit the cron schedule in `setup.sh` (default: every 10 minutes)
