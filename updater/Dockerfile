# Use the official uv image which has Python and uv pre-installed
FROM ghcr.io/astral-sh/uv:python3.12-bookworm-slim

# Install system dependencies: cron
RUN apt-get update && \
    apt-get install -y cron && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Set the working directory
WORKDIR /app

# Copy project files
COPY src /app/src
COPY backups /app/backups
COPY .env /app/
COPY pyproject.toml uv.lock /app/

# Install dependencies with uv (using lock file for reproducibility)
RUN uv sync --frozen

# Add the cron job
COPY crontab /etc/cron.d/pldashboard-updater-cron
RUN chmod 0644 /etc/cron.d/pldashboard-updater-cron && \
    crontab /etc/cron.d/pldashboard-updater-cron

# Run cron in foreground
CMD ["cron", "-f"]