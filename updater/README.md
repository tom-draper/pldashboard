# Data Updater

A script to fetch the latest data from the football data API, compute metrics and statistics and restructure into a collection of DataFrames before uploading to a hosted MongoDB database. When deployed, this script runs as a cron job to update the database at regular intervals.

## Getting Started

```bash
uv sync
uv run updater
```

For a local run that builds from the backups in `backups/`, prints the tables and makes no database writes:

```bash
uv run updater --dev
```

### Docker

```bash
docker build -t pldashboard-updater .
docker run -d --name pldashboard-updater pldashboard-updater
```

Check logs with:

```bash
docker exec -it <container_id> cat /var/log/pldashboard-updater.log
```

### Tests

```bash
uv run pytest
```

## Predictions

The prediction engines live in `src/updater/predictions/models/` behind a common
registry, so they can be scored against each other and swapped in the pipeline by
name. To compare them on past seasons:

```bash
uv run python -m updater.predictions.backtest --list-models
uv run python -m updater.predictions.backtest --seasons 2023,2024,2025
```

Recorded results and what they mean are in
[`docs/prediction-benchmarks.md`](docs/prediction-benchmarks.md).

## Environment Variables

The updater relies on a set of environment variables in `.env` in order to configure the current football season, access data from the football data API, and login to the MongoDB database to upload data.

```text
SEASON=<year>
URL=https://api.football-data.org/
X_AUTH_TOKEN=<X-AUTH-TOKEN from football-data.org>
MONGODB_USERNAME=<MongoDB username>
MONGODB_PASSWORD=<MongoDB password>
MONGODB_DATABASE=<MongoDB database name>
```
