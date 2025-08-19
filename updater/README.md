# Data Updater

A script to fetch the latest data from the football data API, compute metrics and statistics and restructure into a collection of DataFrames before uploading to a hosted MongoDB database. When deployed, this script runs as a cron job to update the database at regular intervals.

## Getting Started

```bash
uv install
uv run src/main.py
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

## Environment Variables

The backend relies on a set of environment variables in `updater/.env` in order to configure the current football season, access data from the football data API, and login to the MongoDB database to upload data.

```text
SEASON=<year>
URL=https://api.football-data.org/
X_AUTH_TOKEN=<X-AUTH-TOKEN from football-data.org>
MONGODB_USERNAME=<MongoDB username>
MONGODB_PASSWORD=<MongoDB password>
MONGODB_DATABASE=<MongoDB database name>
```
