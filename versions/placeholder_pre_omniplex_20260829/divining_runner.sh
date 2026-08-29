#!/bin/bash
# Cron runner with timeout protection
MOSMIL_BIN="/usr/local/bin/mosmil"
SCRIPT_PATH="$(dirname "$0")/distributed_divining_prosumer.mosmil"
LOG_FILE="$(dirname "$0")/divining_activated.log"

{
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cron execution started"
    timeout 30 "$MOSMIL_BIN" "$SCRIPT_PATH" 2>&1 || {
        EXIT_CODE=$?
        if [ $EXIT_CODE -eq 124 ]; then
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ TIMEOUT: mosmil exceeded 30 seconds"
        else
            echo "[$(date '+%Y-%m-%d %H:%M:%S')] ⚠ FAILED: mosmil exited with code $EXIT_CODE"
        fi
    }
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] Cron execution completed"
    echo ""
} >> "$LOG_FILE"
