# Use an official Python runtime as a parent image
FROM python:3.12-slim

WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y cron && apt-get clean && rm -rf /var/lib/apt/lists/*

# Copy pyproject + lockfile first (to leverage Docker cache)
COPY pyproject.toml /app/

# Install build tools and deps
RUN pip install --upgrade pip setuptools wheel && \
    pip install .

# Copy source code and other files
COPY src /app/src
COPY backups /app/backups
COPY .env /app/

# Add the cron job
COPY crontab /etc/cron.d/pldashboard-updater-cron
RUN chmod 0644 /etc/cron.d/pldashboard-updater-cron && crontab /etc/cron.d/pldashboard-updater-cron

CMD ["cron", "-f"]
