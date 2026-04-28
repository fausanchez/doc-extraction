#!/usr/bin/env bash
# One-time setup script to create all Cloudflare resources for doc-extraction.
# Run this once before your first deploy:
#   bash scripts/setup-cloudflare.sh
#
# Requirements:
#   - wrangler installed and logged in (wrangler login)
#   - pnpm installed

set -e

echo "==> Logging in to Cloudflare..."
wrangler login

# ── D1 Databases ────────────────────────────────────────────────────────────────

echo ""
echo "==> Creating D1 databases..."

DEVELOP_DB=$(wrangler d1 create doc-extraction-develop --json 2>/dev/null | grep '"uuid"' | awk -F'"' '{print $4}')
PRODUCTION_DB=$(wrangler d1 create doc-extraction-production --json 2>/dev/null | grep '"uuid"' | awk -F'"' '{print $4}')

echo "   develop  database_id: $DEVELOP_DB"
echo "   production database_id: $PRODUCTION_DB"
echo ""
echo "   ⚠️  Update wrangler.jsonc in apps/api with these IDs:"
echo "      develop  -> $DEVELOP_DB"
echo "      production -> $PRODUCTION_DB"

# ── R2 Buckets ──────────────────────────────────────────────────────────────────

echo ""
echo "==> Creating R2 buckets..."
wrangler r2 bucket create doc-extraction-develop  || true
wrangler r2 bucket create doc-extraction-production || true

# ── Cloudflare Pages projects ───────────────────────────────────────────────────

echo ""
echo "==> Creating Cloudflare Pages projects..."
wrangler pages project create doc-extraction-app     --production-branch main || true
wrangler pages project create doc-extraction-website --production-branch main || true

# ── API secrets ─────────────────────────────────────────────────────────────────

echo ""
echo "==> Setting API secrets for the develop environment..."
echo "   (You'll be prompted to paste each secret value)"

wrangler secret put ANTHROPIC_API_KEY   --env develop
wrangler secret put JWT_SECRET          --env develop
wrangler secret put GOOGLE_CLIENT_SECRET --env develop
wrangler secret put GITHUB_CLIENT_SECRET --env develop

echo ""
echo "==> Setting API secrets for the production environment..."
wrangler secret put ANTHROPIC_API_KEY   --env production
wrangler secret put JWT_SECRET          --env production
wrangler secret put GOOGLE_CLIENT_SECRET --env production
wrangler secret put GITHUB_CLIENT_SECRET --env production

# ── Run migrations ──────────────────────────────────────────────────────────────

echo ""
echo "==> Running database migrations..."
cd apps/api
pnpm db:migrate:develop
pnpm db:migrate:production
cd ../..

echo ""
echo "✅  Setup complete!"
echo ""
echo "Next steps:"
echo "  1. Update apps/api/wrangler.jsonc with the database IDs shown above"
echo "  2. Copy apps/app/.env.example  -> apps/app/.env.production  and fill in the values"
echo "  3. Copy apps/website/.env.example -> apps/website/.env.production and fill in the values"
echo "  4. Run: pnpm deploy:production"
