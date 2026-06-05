#!/usr/bin/env bash
# ============================================
# Q-CMS Metrics Collection
# Collects key performance metrics from a running Q-CMS instance.
# Outputs JSON suitable for CI reporting / dashboards.
# ============================================
set -euo pipefail

API_URL="${API_URL:-http://localhost:3000}"
ADMIN_URL="${ADMIN_URL:-http://localhost:3001}"
RESULTS_DIR="${RESULTS_DIR:-./metrics-results}"
mkdir -p "$RESULTS_DIR"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

log() { echo -e "${BLUE}[$(date -u +%H:%M:%S)]${NC} $*"; }
ok()  { echo -e "${GREEN}✓${NC} $*"; }
fail(){ echo -e "${RED}✗${NC} $*"; }
warn(){ echo -e "${YELLOW}⚠${NC} $*"; }

# ============================================
# 1. Health checks
# ============================================
log "Checking health endpoints..."

HEALTH=$(curl -fsS "$API_URL/api/v1/health" 2>/dev/null || echo "FAIL")
READY=$(curl -fsS "$API_URL/api/v1/ready" 2>/dev/null || echo "FAIL")

if [[ "$HEALTH" == *'"status":"ok"'* ]]; then
  ok "Liveness: ok"
else
  fail "Liveness: $HEALTH"
fi

if [[ "$READY" == *'"status":"ok"'* ]]; then
  ok "Readiness: ok"
  echo "$READY" | jq -c '{checks: .checks}' > "$RESULTS_DIR/readiness.json"
else
  fail "Readiness: $READY"
fi

# ============================================
# 2. API latency benchmark
# ============================================
log "Benchmarking API latency (1000 requests, concurrency 50)..."

if command -v hey &>/dev/null; then
  hey -n 1000 -c 50 -m GET "$API_URL/api/v1/health" > "$RESULTS_DIR/hey-health.txt" 2>&1
  P50=$(grep "  50%" "$RESULTS_DIR/hey-health.txt" | awk '{print $4}')
  P95=$(grep "  95%" "$RESULTS_DIR/hey-health.txt" | awk '{print $4}')
  P99=$(grep "  99%" "$RESULTS_DIR/hey-health.txt" | awk '{print $4}')
  RPS=$(grep "Requests/sec" "$RESULTS_DIR/hey-health.txt" | awk '{print $2}')
  ok "p50=$P50 p95=$P95 p99=$P99 RPS=$RPS"
  jq -n --arg p50 "$P50" --arg p95 "$P95" --arg p99 "$P99" --arg rps "$RPS" \
    '{p50: $p50, p95: $p95, p99: $p99, rps: $rps}' > "$RESULTS_DIR/latency.json"
else
  warn "hey not installed; skipping load test (install: go install github.com/rakyll/hey@latest)"
  # Fallback: simple curl timing
  log "Running 100 sequential requests as fallback..."
  for i in $(seq 1 100); do
    curl -fsS -o /dev/null -w "%{time_total}\n" "$API_URL/api/v1/health"
  done > "$RESULTS_DIR/curl-times.txt"
  P50_MS=$(sort -n "$RESULTS_DIR/curl-times.txt" | awk 'NR==50{printf "%.0f", $1*1000}')
  P95_MS=$(sort -n "$RESULTS_DIR/curl-times.txt" | awk 'NR==95{printf "%.0f", $1*1000}')
  P99_MS=$(sort -n "$RESULTS_DIR/curl-times.txt" | awk 'NR==99{printf "%.0f", $1*1000}')
  ok "p50=${P50_MS}ms p95=${P95_MS}ms p99=${P99_MS}ms (fallback)"
  jq -n --argjson p50 "$P50_MS" --argjson p95 "$P95_MS" --argjson p99 "$P99_MS" \
    '{p50: $p50, p95: $p95, p99: $p99, method: "sequential"}' > "$RESULTS_DIR/latency.json"
fi

# ============================================
# 3. Check against NFR targets
# ============================================
log "Checking NFR compliance..."

P99_TARGET_MS=80
P99_CURRENT_MS=$(jq -r '.p99 // empty' "$RESULTS_DIR/latency.json" | sed 's/ms//' | sed 's/s//' | awk '{ if ($1 < 1) printf "%.0f", $1*1000; else printf "%.0f", $1 }')

if [[ -z "$P99_CURRENT_MS" ]]; then
  warn "Could not parse p99"
elif [[ "$P99_CURRENT_MS" -le "$P99_TARGET_MS" ]]; then
  ok "p99 latency: ${P99_CURRENT_MS}ms ≤ ${P99_TARGET_MS}ms target"
else
  fail "p99 latency: ${P99_CURRENT_MS}ms > ${P99_TARGET_MS}ms target"
fi

# ============================================
# 4. Test coverage from previous test runs
# ============================================
log "Collecting test coverage..."

COVERAGE_SUMMARY="{}"
for f in $(find . -path ./node_modules -prune -o -name "coverage-summary.json" -print 2>/dev/null); do
  pkg=$(dirname "$f" | sed 's|^./||')
  pct=$(jq -r '.total.lines.pct // 0' "$f" 2>/dev/null || echo "0")
  COVERAGE_SUMMARY=$(echo "$COVERAGE_SUMMARY" | jq --arg p "$pkg" --argjson v "$pct" '. + {($p): $v}')
done
echo "$COVERAGE_SUMMARY" > "$RESULTS_DIR/coverage.json"
TOTAL_COV=$(echo "$COVERAGE_SUMMARY" | jq 'to_entries | map(.value) | add / length // 0')
ok "Average line coverage: ${TOTAL_COV}%"

if (( $(echo "$TOTAL_COV >= 80" | bc -l) )); then
  ok "Coverage ≥ 80% target"
else
  warn "Coverage < 80% target (NFR-MAINT-01)"
fi

# ============================================
# 5. Bundle size check (admin)
# ============================================
ADMIN_BUNDLE=$(find apps/admin/.next/static -name "*.js" 2>/dev/null | xargs -I{} stat -c '%s' {} 2>/dev/null | awk '{s+=$1} END {print s/1024}' || echo "0")
if [[ "$ADMIN_BUNDLE" != "0" && -n "$ADMIN_BUNDLE" ]]; then
  log "Admin initial bundle: ${ADMIN_BUNDLE}KB"
  if (( $(echo "$ADMIN_BUNDLE <= 250" | bc -l) )); then
    ok "Admin bundle ≤ 250KB target"
  else
    warn "Admin bundle > 250KB target (NFR-PERF-01)"
  fi
fi

# ============================================
# 6. Summary
# ============================================
log "Generating summary report..."

SUMMARY=$(jq -n \
  --arg ts "$(date -u +%Y-%m-%dT%H:%M:%SZ)" \
  --arg api_url "$API_URL" \
  --slurpfile lat "$RESULTS_DIR/latency.json" \
  --slurpfile cov "$RESULTS_DIR/coverage.json" \
  --argjson total_cov "$TOTAL_COV" \
  '{
    timestamp: $ts,
    api_url: $api_url,
    latency: $lat[0],
    coverage: { average_pct: $total_cov, per_package: $cov[0] },
    targets: {
      p99_ms: 80,
      coverage_pct: 80,
      bundle_kb: 250
    }
  }')

echo "$SUMMARY" > "$RESULTS_DIR/summary.json"
ok "Summary written to $RESULTS_DIR/summary.json"
echo ""
cat "$RESULTS_DIR/summary.json" | jq .

if [[ -n "${GITHUB_STEP_SUMMARY:-}" ]]; then
  echo "## Q-CMS Metrics Report" >> "$GITHUB_STEP_SUMMARY"
  echo '```json' >> "$GITHUB_STEP_SUMMARY"
  cat "$RESULTS_DIR/summary.json" >> "$GITHUB_STEP_SUMMARY"
  echo '```' >> "$GITHUB_STEP_SUMMARY"
fi
