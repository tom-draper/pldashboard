# Use an official Python runtime as a parent image
FROM python:3.10-slim

# Set the working directory in the container
WORKDIR /app

# Copy the local script to the container
COPY src /app/src
COPY backups /app/backups
COPY .env /app/

# Copy requirements.txt and install dependencies
COPY requirements.txt /app/
RUN pip install -r requirements.txt

# Install cron and any other dependencies you need
RUN apt-get update && \
    apt-get install -y cron && \
    apt-get clean && \
    rm -rf /var/lib/apt/lists/*

# Add the cron job file to the container
COPY crontab /etc/cron.d/pldashboard-updater-cron

# Give execution rights on the cron job
RUN chmod 0644 /etc/cron.d/pldashboard-updater-cron

# Apply cron job
RUN crontab /etc/cron.d/pldashboard-updater-cron

# Run the cron service in the foreground
CMD ["cron", "-f"]