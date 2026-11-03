# Reference integration v1 — running and boundaries

This branch implements the first visible ingestion slice, with baseline cleanup and a documented-only candidate-provider assessment. It does not implement a live provider, historical coverage certification, model jobs, procurement or the final experiments.

## One-command startup

Run `bash start.sh` from the repository root. Open the printed URL: the original animated landing page appears, then **Launch Dashboard** opens the dashboard with Products, Vendors, Inventory, Orders and Forecasting Lab. **Connections** is an extra sidebar tab, not the entry page. Your normal dashboard does not require a workspace token. The launcher starts the Python ML service as well as the app, reference source and worker.

If `backend/.env` already has a database URL, the original ERP uses it, preserving access to your existing records. The launcher does not migrate or seed that database. The experimental reference connection uses its own local `smarterp_local` database, even when the ERP uses another database. For an explicitly isolated demonstration, set `SMARTERP_APP_DATABASE_URL` to a separate local database before launching. With no existing database configuration the original app uses the local database and may initially be empty.

The Connections tab currently demonstrates a synthetic external source and requires its own token, printed as **Connections tab token**. Live provider integration and displaying imported facts through the original ERP pages are not complete yet. The original app remains available throughout that work. Connection records are not silently mixed into your existing catalog.

The first launch installs dependencies and prepares a dedicated loopback-only MongoDB replica set. Private token, reference state and logs are saved under ignored `.local/`. Ctrl+C stops app processes; local data persists. Requirements: Node 22+, pnpm, Python 3 and a running Docker engine. Application ports are selected automatically if occupied.

## Local setup

Requirements: Node 22+, pnpm 10+ (repository lockfiles), Python 3.12+, Docker for an isolated MongoDB replica set. Use the installed/tested versions recorded in the dependency files. Do not overwrite an existing `.env` containing business credentials.

1. Install dependencies in `backend` and `frontend` with `pnpm install --frozen-lockfile` (the existing lockfiles are retained; the only new frontend development dependency is Playwright for browser verification).
2. Start a development-only database:

   ```bash
   docker run -d --name smarterp-dev-mongo -p 127.0.0.1:27120:27017 mongo:7.0 --replSet rs0 --bind_ip_all
   docker exec smarterp-dev-mongo mongosh --quiet --eval 'rs.initiate({_id:"rs0",members:[{_id:0,host:"127.0.0.1:27017"}]})'
   ```

3. Create a separate backend development environment using `backend/.env.example`. The example targets `smarterp_dev` on port 27120. Do not use a real business database for this demonstration.
4. In `backend`, run `pnpm exec prisma generate` and then `pnpm exec prisma db push` against that new database. Schema push is a deliberate operator action, never an API/startup side effect.
5. In `backend`, run `pnpm provision "Reference workspace" "Europe/Berlin"`. Save the one-time workspace token privately. Only its hash is stored. This is a minimal provisioned administrator credential, not a complete user-account product.
6. For manual startup, run `pnpm reference`, `pnpm worker` and `pnpm dev` in separate backend terminals; run `pnpm dev` in frontend. Start the Python ML service separately for forecasting. The one-command launcher handles all these processes automatically.
7. Open the frontend, click **Launch Dashboard**, then open **Connections**, enter the token and select **Connect reference source**. The worker polls automatically (30 seconds by default). The page refreshes every five seconds.

Expected result: one source product, three fulfilled units, and **20 available stock**, not 17. A completed collection does not establish complete historical data; forecasting is explicitly blocked.

## Update and recovery demonstration

The separate reference HTTP service copies `reference-source/data/seed.json` to ignored `state.json` on first run. Edit `state.json` to change quantities, increasing the affected record's integer revision. Writes should be atomic when editing while pagination runs. The source snapshot hash detects changes between pages; the next full collection retries safely.

An exact replay creates no new business effect. A later revision replaces the canonical quantity. A lower revision is ignored. A conflicting payload with the same identity/revision is quarantined, retaining the first payload and blocking applied status. Resolving such conflicts is not automated in v1; fix source revisions and investigate the quarantined record. Only failed/unmapped records are eligible for the UI retry action.

Stop the source to observe a collection error; restart it to recover. Stop/restart the worker to show durable inbox recovery. Unmapped source products are quarantined; a subsequent product import enables reprocessing without guessing names.

## Versioned contract and scope

`reference-v1` is a synthetic full-snapshot, single-location, integer-revision source. It returns pages of at most 100 normalized records, a snapshot hash and a next cursor. The sample source pages two records at a time. Records contain UTC event/update times, stable external IDs, explicit quantities and minimal fields. Source payloads are strict; unexpected customer/payment fields are rejected rather than retained.

Source products are the initial stable external-to-internal identity map. Integration collections are separate from the unscoped legacy ERP collections to avoid reclassifying existing demo data or granting integrated users access to it. No sale processing calls the legacy order service. Durable records preserve received/applied times. Transactions pair canonical effects with fenced processing status. Lease recovery is implemented; full distributed scheduling, backoff, scoped date coverage, mapping editing and reconciliation remain later milestones.

Polling intentionally recollects the full small reference snapshot. This proves ingestion and replay, not scalable incremental synchronization. The original ERP remains available by default locally alongside Connections. Set `ENABLE_LEGACY_DEMO=false` only for an intentionally integration-only API test environment. Unauthenticated ERP endpoints remain unavailable in production. Existing forecasts still have historical evaluation limitations and are not the future integrated operational pipeline.

## Existing database transition

No existing database was modified during development. New integration collections are additive and require a deliberate schema/index rollout. Before any existing database is touched: back it up, run the schema against a copy, inspect proposed indexes/collections, and verify legacy counts and new unique constraints. Do not run destructive reset commands. To roll back application code, disable integrations and retain the additive collections; no legacy-record conversion is needed for this slice. A general legacy-business migration is deferred until those models are integrated.

## API and credential boundaries

`/api/integrations/status`, connection creation and retry require a high-entropy Bearer workspace token. Business scope comes from the hash lookup, not a request body ID. Status never returns token hashes or raw source payloads. UI credentials stay in React memory and clear on closing/reload. Provision another token/business rather than sharing it publicly; account membership and rotation tooling are subsequent work.

No arbitrary outbound URL is accepted by the API. The reference destination is operator-configured, IPv4 loopback only, development-only and opt-in; redirects are rejected. Source credentials/webhook endpoints are not implemented. No cross-business database pointers are accepted from requests. The original ERP API and its demo actions are local-development features; the separately authenticated Connections API cannot mutate the original ERP collections.

## Tests

```bash
cd backend
pnpm typecheck
pnpm test
cd ..
bash scripts/test-integration.sh
cd frontend
pnpm typecheck
pnpm build
cd ../ml-service
python -m unittest discover -s tests -v
```

The integration script creates a temporary loopback-only replica set and cleans up only that container. It tests real transactions, repeated delivery, version ordering, expired leases, partial-page failure, cross-business access and preservation of source stock. No production credentials or managed databases are used.

## Next milestone

Expand the first slice with scoped coverage/manifests, mapping corrections and the full correction invalidation lifecycle before introducing immutable forecast datasets and operational model jobs. Apply the accepted experiment clarifications in `IMPLEMENTATION_PLAN.md` before implementing experiments. Real-provider verification remains pending authorized account access.

## Browser verification

Install Chromium once with `pnpm exec playwright install chromium` from `frontend`. Run `RUN_BROWSER_TESTS=1 bash scripts/test-integration.sh` from the repository root. This starts the real reference source, polling worker, API and frontend against the script's isolated database. It verifies automatic ingestion, a source correction without duplicate fulfillment, source stock remaining unchanged, and sign-out clearing workspace data. No browser API mocking is used. CI runs this workflow; browser credentials and source files are temporary.

## Local verification record — November 3, 2026

- Backend and frontend TypeScript checks passed.
- Frontend production build passed; the existing large-chunk warning remains.
- Four backend contract tests, two database/API integration scenarios, and six Python tests passed. Integration scenarios include many assertions for replay, revision ordering, expired/exhausted leases, concurrent claims, partial collection and business isolation.
- Repository browser script passed against the real running reference HTTP process, polling worker, API and frontend. A correction changed fulfilled units from 3 to 6, with one canonical fulfillment and stock still 20. Sign-out cleared visible data; no browser runtime errors occurred.
- A separate local native-model smoke run returned 30 finite nonnegative values from each of Linear Regression, XGBoost, LightGBM, Prophet and PyTorch LSTM. This is a smoke check, not evidence of forecast accuracy or the future multi-step evaluation protocol.
- A CI workflow was added; remote CI execution has not been observed.

Verification used only temporary/local replica-set databases. No existing business database or external provider account was modified. Source credentials and generated bytecode are excluded from tracking; existing local environment files are retained.

## Restored application entry flow

The default experience is the original landing animation → Launch Dashboard → existing app tabs, with Connections added last. Tokens belong only to the experimental Connections tab. Browser regression checks cover the landing button, navigation, original API availability, and the source integration workflow together. The launcher explicitly keeps the existing ERP database separate from its newly provisioned connection database.
