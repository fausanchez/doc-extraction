-- Wipes all API token data from the local / develop D1 database.
-- Run with:
--   pnpm --filter api db:reset-tokens          (local)
--   pnpm --filter api db:reset-tokens:develop   (remote develop)
--
-- Never run this against production.
DELETE FROM api_token_usage_daily;
DELETE FROM api_tokens;
