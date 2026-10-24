#!/usr/bin/env bash
# Lighthouse (mobile + desktop) against the local preview.
# Needs: npx (downloads lighthouse on first run) and a Chrome/Chromium (set CHROME_PATH if not found).
set -euo pipefail
cd "$(dirname "$0")/.."
PORT=8090
NO_FAIL=1 node tools/serve.mjs $PORT >/dev/null 2>&1 & SRV=$!
trap 'kill $SRV' EXIT
sleep 0.7
mkdir -p .lighthouse
LH=${LIGHTHOUSE:-"npx --yes lighthouse@13"}
for ff in mobile desktop; do
  extra=""; [ "$ff" = desktop ] && extra="--preset=desktop"
  $LH "http://localhost:$PORT/" $extra --only-categories=performance,accessibility,best-practices,seo \
    --chrome-flags="--headless=new --no-sandbox" --output=json --output=html --output-path=".lighthouse/$ff" --quiet
  node -e "const r=require('./.lighthouse/$ff.report.json');console.log('$ff', Object.values(r.categories).map(c=>c.id+' '+Math.round(c.score*100)).join(' · '));for(const k of ['first-contentful-paint','largest-contentful-paint','total-blocking-time','cumulative-layout-shift','speed-index'])console.log('   ',k,r.audits[k].displayValue)"
done
