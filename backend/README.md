# Backend

## FastAPI Server

An API that serves data from the hosted MongoDB database to the frontend dashboard.

```bash
python server/app.py
```

## Data Updater

A script to fetch new data from the football data API, compute metrics and statistics and restructure into dataframes before uploading to the MongoDB database. This script is scheduled to run at regular intervals to continuously refresh the data stored in the database.

```bash
python updater/main.py
```

### Tests

```bash
python -m pytest updater/tests/tests.py
```

## Environment Variables

The backend relies on a set of environment variables in `/backend/.env` in order to access data from the football data API, and login to the MongoDB database to upload data.

```text
URL=https://api.football-data.org/v2/
X_AUTH_TOKEN=<X-AUTH-TOKEN from football-data.org>
MONGODB_USERNAME=<MongoDB username>
MONGODB_PASSWORD=<MongoDB password>
MONGODB_DATABASE=<MongoDB database name>
```
