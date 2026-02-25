#!/bin/bash
set -euo pipefail

# Quick health check for all services
# Usage: ./scripts/health-check.sh [api_url]

API_URL="${1:-http://localhost:8000}"

echo "=== P2P Marketplace Health Check ==="
echo "API: $API_URL"
echo ""

# Backend health
echo -n "Backend API:    "
HEALTH=$(curl -sf --max-time 5 "$API_URL/health" 2>/dev/null)
if [ $? -eq 0 ]; then
    echo "OK"
else
    echo "FAIL"
fi

# Docker services (if available)
if command -v docker &> /dev/null; then
    echo ""
    echo "Docker Services:"
    docker compose ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
    docker compose -f docker-compose.prod.yml ps --format "table {{.Service}}\t{{.Status}}\t{{.Ports}}" 2>/dev/null || \
    echo "  (docker compose not running)"
fi

# Database
echo ""
echo -n "Database:       "
DB_STATUS=$(echo "$HEALTH" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("database","unknown"))' 2>/dev/null || echo "unknown")
echo "$DB_STATUS"

# Redis
echo -n "Redis:          "
REDIS_STATUS=$(echo "$HEALTH" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("redis","unknown"))' 2>/dev/null || echo "unknown")
echo "$REDIS_STATUS"

# Disk usage
echo ""
echo "Disk Usage:"
df -h / | tail -1 | awk '{print "  Used: " $3 " / " $2 " (" $5 ")"}'

# Memory
echo ""
echo "Memory:"
if [[ "$(uname)" == "Darwin" ]]; then
    vm_stat | head -5
else
    free -h | head -2
fi

echo ""
echo "=== Done ==="
