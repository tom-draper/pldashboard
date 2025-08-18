# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Install system dependencies: cron + curl (needed for uv install)
RUN apt-get update && \
    apt-get install -y curl cron && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install uv and verify installation
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    ls -la /root/.cargo/bin/ && \
    /root/.cargo/bin/uv --version

# Add uv to PATH
ENV PATH="/root/.cargo/bin:${PATH}"

# Verify uv is in PATH
RUN which uv && uv --version

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