#!/bin/bash
# A script to copy downloaded data files from a docker container to local backup

# Check for required command line arguments
if [ $# -lt 1 ]; then
  echo "Usage: $0 <container_id> <season>"
  exit 1
fi

docker cp $1:/app/backups/fixtures/fixtures_$2.json ~/pldashboard/updater/backups/fixtures/fixtures_$2.json
docker cp $1:/app/backups/standings/standings_$2.json ~/pldashboard/updater/backups/standings/standings_$2.json
docker cp $1:/app/backups/fantasy/fixtures_$2.json ~/pldashboard/updater/backups/fantasy/fixtures_$2.json
docker cp $1:/app/backups/fantasy/general_$2.json ~/pldashboard/updater/backups/fantasy/general_$2.json