# Use an official Python runtime as a parent image
FROM python:3.12-slim

# Install system dependencies: cron + curl (needed for uv install)
RUN apt-get update && \
    apt-get install -y curl cron && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Install uv and add to PATH in one step
RUN curl -LsSf https://astral.sh/uv/install.sh | sh && \
    echo 'export PATH="/root/.cargo/bin:$PATH"' >> ~/.bashrc

# Add uv to PATH for Docker
ENV PATH="/root/.cargo/bin:${PATH}"

# Set the working directory
WORKDIR /app

# Copy project files
COPY src /app/src
COPY backups /app/backups
COPY .env /app/
COPY pyproject.toml uv.lock /app/

# Install dependencies with uv - use explicit path to be safe
RUN /root/.cargo/bin/uv sync --frozen

# Add the cron job
COPY crontab /etc/cron.d/pldashboard-updater-cron
RUN chmod 0644 /etc/cron.d/pldashboard-updater-cron && \
    crontab /etc/cron.d/pldashboard-updater-cron

# Run cron in foreground
CMD ["cron", "-f"]