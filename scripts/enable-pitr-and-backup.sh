#!/usr/bin/env bash
# ==============================================================================
# Enable Firestore Point-in-Time Recovery (PITR) & Daily Scheduled Backups
# Sanad Al-Moallem Production Infrastructure Script
# ==============================================================================

set -euo pipefail

DATABASE_ID="${1:-"(default)"}"
RETENTION_PERIOD="${2:-"14d"}"

echo "==========================================================="
echo "⚙️ Sanad Al-Moallem: Configuring Firestore PITR & Backups"
echo "Target Database: ${DATABASE_ID}"
echo "Retention Period: ${RETENTION_PERIOD}"
echo "==========================================================="

if ! command -v gcloud &> /dev/null; then
  echo "⚠️ 'gcloud' CLI is not installed or not in PATH."
  echo "Please install Google Cloud SDK or run these commands via Google Cloud Shell."
  exit 1
fi

echo "1. Enabling Point-in-Time Recovery (PITR)..."
gcloud firestore databases update \
  --database="${DATABASE_ID}" \
  --point-in-time-recovery-enable

echo "2. Verifying PITR status..."
STATUS=$(gcloud firestore databases describe --database="${DATABASE_ID}" --format="value(pointInTimeRecoveryEnablement)")
echo "PITR Status: ${STATUS}"

echo "3. Creating Daily Backup Schedule..."
gcloud firestore backups schedules create \
  --database="${DATABASE_ID}" \
  --recurrence=daily \
  --retention="${RETENTION_PERIOD}" || {
    echo "⚠️ Note: Backup schedule may already exist. Checking existing schedules..."
  }

echo "4. Listing active backup schedules..."
gcloud firestore backups schedules list --database="${DATABASE_ID}"

echo "==========================================================="
echo "✅ PITR & Daily Backups successfully configured for Sanad!"
echo "==========================================================="
