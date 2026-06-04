# Implementation Plan: Saguaro Labs 3D — Filament Quoting Tool

## Overview

Build and deploy a self-serve STL quoting tool for Saguaro Labs 3D. Customers upload an STL
file on their Squarespace site, receive an instant automated price, and pay via Stripe. The STL
is stored in Google Drive and the owner is notified by email. Invalid or oversized STLs route
to a manual quote fallback form.

18 tasks across 4 phases. Each task is S or M sized (1–5 files). Phases 1 and 2 are strictly
sequential; Phase 3 (frontend) can begin in parallel with Phase 2 backend tasks once the API
contracts are defined.

---

## Architecture Decisions

- **Pricing logic lives in two places:** `api/lib/pricing.js` (server, Node.js) and inlined in
  `frontend/widget.js` (client, vanilla JS). They must implement the same formula. The server
  copy is authoritative — it re-derives price before creating the Stripe session to prevent
  client-side tampering. A comment in each file cross-references the other.

- **STL upload before Stripe redirect:** The STL is uploaded to a temp Google Drive folder when
  the customer clicks "Accept & Pay", before the Stripe redirect. This ensures the file is safe
  regardless of payment outcome. The temp file ID is passed through the Stripe session metadata.

- **No framework on the frontend:** The widget is vanilla JS + CSS, bundled into a single
  `dist/widget.min.js` via esbuild. It loads Three.js STLLoader from CDN. This keeps the
  Squarespace embed to a single `<script>` tag.

- **CORS on all API endpoints:** Squarespace pages make cross-origin requests to Vercel. All
  endpoints set `Access-Control-Allow-Origin` to the Squarespace domain only (not `*`).

- **Temp file cleanup:** A Vercel cron job runs daily and deletes temp Drive files older than
  24 hours that have no associated completed Stripe payment. Vercel free tier supports daily
  cron frequency, which is sufficient.

---

## Dependency Graph

```
Task 1: Project scaffold
    │
    ├── Task 2: Config system + pricing logic
    │       │
    │       ├── Task 3: STL parser
    │       │
    │       └── Task 4: Google Drive service ──┐
    │               │                          │
    │               └── Task 5: Email service  │
    │                       │                  │
    │                       ├── Task 6: /api/upload-stl ────────────────────┐
    │                       ├── Task 7: /api/create-checkout ───────────────┤
    │                       ├── Task 8: /api/webhook ──────────────────────┐│
    │                       ├── Task 9: /api/manual-quote                  ││
    │                       └── Task 10: Cron cleanup                      ││
    │                                                                       ││
    └── Task 11: Widget scaffold ──────────────────────────────────────────┘│
            │                                                                │
            ├── Task 12: STL parsing + price display                        │
            ├── Task 13: Accept & Pay flow (uses Tasks 6 + 7) ─────────────┘
            ├── Task 14: Post-payment status handling
            └── Task 15: Manual quote fallback form
                    │
                    └── Task 16: CORS + security hardening
                            │
                            └── Task 17: Build pipeline
                                    │
                                    └── Task 18: Deploy + embed instructions
```

---

## Task List

### Phase 1: Foundation

---

#### Task 1: Project scaffold

**Description:** Initialize the Node.js project with all config files, directory structure,
and tooling. No application logic — just the skeleton everything else builds on.

**Acceptance criteria:**
- [ ] `package.json` present with scripts: `dev`, `build`, `test`, `lint`, `deploy`
- [ ] `vercel.json` present with function routing and cron job placeholder
- [ ] `.env.example` lists all 10 required environment variables with placeholder values
- [ ] `config.json` present with all four filaments, three strength presets, and all pricing params
- [ ] `eslint.config.js` and `jest.config.js` present and functional
- [ ] `npm install && npm test` runs without error (no tests yet, just confirms setup)

**Verification:**
- [ ] `npm install` completes cleanly
- [ ] `npm run lint` runs without error on empty src
- [ ] `npm test` exits 0 (no test files = pass)

**Dependencies:** None

**Files:**
- `package.json`
- `vercel.json`
- `.env.example`
- `config.json`
- `eslint.config.js`
- `jest.config.js`

**Scope:** M

---

#### Task 2: Config loader + pricing logic

**Description:** Write the shared pricing utility used by all backend API functions, plus the
config loader that reads `config.json` at runtime. Includes full unit test coverage for the
pricing formula and edge cases.

**Acceptance criteria:**
- [ ] `api/lib/config.js` exports `loadConfig()` — reads and returns parsed `config.json`
- [ ] `api/lib/pricing.js` exports `derivePrice(quoteDetails, filamentId, preset, config)`
- [ ] Pricing formula matches spec exactly (infill/100, support multiplier, margin, floor)
- [ ] `tests/pricing.test.js` covers: standard calculation, minimum price floor, support
  multiplier applied, support multiplier not applied, all four filament types, all three
  strength presets, zero-volume guard

**Verification:**
- [ ] `npm test -- --testPathPattern pricing` passes with 90%+ coverage on pricing.js

**Dependencies:** Task 1

**Files:**
- `api/lib/config.js`
- `api/lib/pricing.js`
- `tests/pricing.test.js`

**Scope:** S

---

#### Task 3: STL parser

**Description:** Write the client-side STL parser that calculates volume, bounding box, and
support heuristic from raw STL binary/ASCII data using the signed tetrahedra method. This
runs in the browser — no server needed.

**Acceptance criteria:**
- [ ] `frontend/stl-parser.js` exports `parseSTL(arrayBuffer)` returning
  `{ volume_cm3, bbox, supports_likely, is_valid }`
- [ ] Volume calculation uses signed tetrahedra summation (exact for watertight meshes)
- [ ] Support heuristic: `supports_likely = true` if any face normal Z < -0.5
- [ ] `is_valid = false` if mesh is not watertight (open edges detected) or volume ≤ 0
- [ ] Handles both binary and ASCII STL formats
- [ ] `tests/stl-parser.test.js` covers: known-volume cube (verify within 1%), non-watertight
  mesh returns invalid, ASCII format, binary format, support heuristic positive + negative

**Verification:**
- [ ] `npm test -- --testPathPattern stl-parser` passes with 90%+ coverage

**Dependencies:** Task 1

**Files:**
- `frontend/stl-parser.js`
- `tests/stl-parser.test.js`
- `tests/fixtures/cube.stl` (test fixture — 1cm³ known volume)
- `tests/fixtures/open-mesh.stl` (test fixture — non-watertight)

**Scope:** M

---

### Checkpoint: Phase 1

- [ ] `npm test` passes — pricing and STL parser fully covered
- [ ] `npm run lint` clean
- [ ] `config.json` values reviewed by owner (rates, filament costs)
- [ ] Commit and push to GitHub

---

### Phase 2: Backend Services

---

#### Task 4: Google Drive service

**Description:** Write the shared Drive client used by all API endpoints. Handles
authentication via service account, uploading files, moving files between folders, and
listing files for cleanup. No endpoint logic — just the Drive abstraction.

**Acceptance criteria:**
- [ ] `api/lib/drive.js` exports: `uploadFile(buffer, filename, folderId)`,
  `moveFile(fileId, targetFolderId)`, `listFilesOlderThan(folderId, hours)`
- [ ] Authenticates via `GOOGLE_SERVICE_ACCOUNT_EMAIL` + `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY`
- [ ] Returns Google Drive file ID and web link on upload
- [ ] Throws descriptive errors on auth failure or API error

**Verification:**
- [ ] Unit test with mocked googleapis client passes
- [ ] `npm run lint` clean

**Dependencies:** Task 1

**Files:**
- `api/lib/drive.js`
- `tests/api/lib/drive.test.js`

**Scope:** S

---

#### Task 5: Email service + templates

**Description:** Write the shared email client and both HTML email templates: owner
notification and customer confirmation. Uses Nodemailer via Gmail SMTP.

**Acceptance criteria:**
- [ ] `api/lib/email.js` exports: `sendOwnerNotification(orderDetails)`,
  `sendCustomerConfirmation(customerEmail, orderDetails)`,
  `sendOwnerManualQuoteAlert(customerInfo, driveLink)`
- [ ] Owner notification includes: customer name, email, filament, strength, price, weight,
  print time, Drive link
- [ ] Customer confirmation branded with Saguaro Labs 3D name — professional HTML layout,
  sent from `info@saguarolabs3d.com`
- [ ] Both templates render correctly (verified by logging HTML in test)

**Verification:**
- [ ] Unit test with mocked Nodemailer transport passes
- [ ] HTML template visually reviewed in browser (open the string in a `.html` file)

**Dependencies:** Task 1

**Files:**
- `api/lib/email.js`
- `api/lib/templates/owner-notification.js`
- `api/lib/templates/customer-confirmation.js`
- `tests/api/lib/email.test.js`

**Scope:** M

---

#### Task 6: POST /api/upload-stl

**Description:** Serverless function that accepts an STL file upload via multipart/form-data,
validates file type and size, and saves it to the temp Google Drive folder. Returns the temp
file ID for use in the Stripe session metadata.

**Acceptance criteria:**
- [ ] Rejects non-STL MIME types with 400
- [ ] Rejects files >50MB with 400 and message directing to manual quote
- [ ] Uploads valid file to `Saguaro Labs 3D / Temp / {uuid}-{filename}` in Drive
- [ ] Returns `{ temp_file_id, temp_file_name }` on success
- [ ] Sets CORS headers for Squarespace domain

**Verification:**
- [ ] `npm test -- --testPathPattern upload-stl` passes (Drive client mocked)
- [ ] Manual test: POST a valid STL with curl or Postman, file appears in Drive Temp folder

**Dependencies:** Tasks 2, 4

**Files:**
- `api/upload-stl.js`
- `tests/api/upload-stl.test.js`

**Scope:** S

---

#### Task 7: POST /api/create-checkout

**Description:** Serverless function that re-derives price server-side from quote details
and config, then creates a Stripe Checkout session. Returns the Stripe checkout URL.

**Acceptance criteria:**
- [ ] Re-derives price from `quote_details` + `config.json` — never uses client-sent price
- [ ] If re-derived price differs from client price by >5%, returns 400 with error
- [ ] Creates Stripe Checkout session with: correct amount, customer email, `temp_file_id`
  in metadata, `success_url` and `cancel_url` pointing to Squarespace page with `?status=`
- [ ] Sets CORS headers for Squarespace domain

**Verification:**
- [ ] `npm test -- --testPathPattern create-checkout` passes (Stripe client mocked)
- [ ] Manually verify: submit quote details, get a valid Stripe checkout URL back

**Dependencies:** Tasks 2, 6

**Files:**
- `api/create-checkout.js`
- `tests/api/create-checkout.test.js`

**Scope:** S

---

#### Task 8: POST /api/webhook

**Description:** Stripe webhook handler. Verifies signature, retrieves session metadata,
moves the STL from temp to permanent Drive folder, sends branded confirmation email to
customer, and sends notification email to owner. Handles Drive move failure gracefully.

**Acceptance criteria:**
- [ ] Rejects requests with invalid Stripe signature with 400
- [ ] On `checkout.session.completed`: moves STL to `Orders / YYYY-MM / {ts}-{name}-{file}`
- [ ] Sends customer confirmation email on payment success (even if Drive move fails)
- [ ] Sends owner notification with Drive link on success
- [ ] On Drive move failure: sends owner alert with temp file link + customer contact info;
  still sends customer confirmation
- [ ] Returns 200 to Stripe within 30 seconds (Stripe timeout)

**Verification:**
- [ ] `npm test -- --testPathPattern webhook` passes (Stripe + Drive + email all mocked)
- [ ] Simulate webhook with Stripe CLI: `stripe trigger checkout.session.completed`

**Dependencies:** Tasks 4, 5, 7

**Files:**
- `api/webhook.js`
- `tests/api/webhook.test.js`

**Scope:** M

---

#### Task 9: POST /api/manual-quote

**Description:** Accepts manual quote form submissions (name, email, optional note, STL file).
Saves the STL to the Manual Quotes Drive folder and notifies the owner.

**Acceptance criteria:**
- [ ] Accepts `multipart/form-data` with `name`, `email`, `note` (optional), `stl_file`
- [ ] Saves to `Saguaro Labs 3D / Manual Quotes / YYYY-MM / {ts}-{name}-{file}`
- [ ] Sends owner notification email with customer info + Drive link
- [ ] Returns success message: "Got it! We'll review your file and reach out to you within
  1 business day."
- [ ] Sets CORS headers for Squarespace domain

**Verification:**
- [ ] `npm test -- --testPathPattern manual-quote` passes (Drive + email mocked)

**Dependencies:** Tasks 4, 5

**Files:**
- `api/manual-quote.js`
- `tests/api/manual-quote.test.js`

**Scope:** S

---

#### Task 10: Cron cleanup job

**Description:** Daily Vercel cron job that deletes temp Drive files older than 24 hours
that have no associated completed Stripe payment. Prevents temp folder accumulation.

**Acceptance criteria:**
- [ ] `api/cron/cleanup.js` lists all files in the Temp Drive folder
- [ ] Deletes files where `createdTime` is >24 hours ago
- [ ] Skips files that have a corresponding completed Stripe session (checked via Stripe API
  search by metadata `temp_file_id`)
- [ ] `vercel.json` schedules this function at `0 4 * * *` (4am UTC daily)
- [ ] Logs count of deleted files

**Verification:**
- [ ] Unit test with mocked Drive + Stripe clients passes
- [ ] `vercel.json` cron entry validated

**Dependencies:** Tasks 4, 7

**Files:**
- `api/cron/cleanup.js`
- `tests/api/cron/cleanup.test.js`
- `vercel.json` (update)

**Scope:** S

---

### Checkpoint: Phase 2

- [ ] All backend tests pass: `npm test`
- [ ] All four API endpoints respond correctly to manual curl/Postman tests locally
- [ ] Stripe webhook verified with Stripe CLI
- [ ] Drive folders visible in Google Drive: `Saguaro Labs 3D / Temp`, `Orders`, `Manual Quotes`
- [ ] Both email templates reviewed visually
- [ ] Commit and push to GitHub

---

### Phase 3: Frontend Widget

---

#### Task 11: Widget scaffold + CSS

**Description:** Build the widget's HTML structure and scoped CSS. No business logic yet —
just the visual shell: filament dropdown, strength preset selector, drag-and-drop upload zone,
price display area, customer info form, and manual quote form. All CSS uses `.slq-` prefix.

**Acceptance criteria:**
- [ ] `frontend/widget.js` renders the full widget DOM structure into `<div id="slq-widget">`
- [ ] `frontend/widget.css` styles all elements with `.slq-` prefix — no global selectors
- [ ] Widget renders without errors when loaded standalone in a browser
- [ ] Drag-and-drop zone is visible and styled; file picker fallback present
- [ ] Manual quote form section exists but is hidden by default
- [ ] Widget is visually consistent with Saguaro Labs 3D dark industrial aesthetic
  (exact hex codes to be updated when owner confirms palette)

**Verification:**
- [ ] Open `frontend/widget.js` in a local HTML test page — no console errors
- [ ] All UI sections visible and styled correctly

**Dependencies:** Task 1

**Files:**
- `frontend/widget.js`
- `frontend/widget.css`
- `tests/frontend/widget-scaffold.html` (local test harness)

**Scope:** M

---

#### Task 12: STL parsing + price display

**Description:** Wire the STL parser into the widget. When a file is dropped or selected,
parse it client-side, calculate the price using the frontend pricing logic, and display the
quote breakdown (price, weight, print time, settings summary).

**Acceptance criteria:**
- [ ] STL file drop/select triggers parse via `frontend/stl-parser.js`
- [ ] Files >50MB immediately show: "This file is too large for automated quoting. Please
  use the manual quote form below." and reveal the manual quote section
- [ ] Invalid STL (non-watertight, parse error) shows: "Your file didn't pass our automated
  checks and needs to be manually reviewed." and reveals manual quote section
- [ ] Valid STL displays: calculated price, estimated filament weight (g), estimated print
  time, selected filament and strength
- [ ] Price calculation matches the spec formula (tested against known STL fixture)
- [ ] Changing filament or strength preset recalculates and updates display instantly

**Verification:**
- [ ] Upload the `tests/fixtures/cube.stl` — verify price is mathematically correct
- [ ] Upload a file >50MB — correct error shown
- [ ] Upload an invalid STL — correct error shown and manual form revealed

**Dependencies:** Tasks 3, 11

**Files:**
- `frontend/widget.js` (update)
- `frontend/stl-parser.js` (integrate)

**Scope:** M

---

#### Task 13: Accept & Pay flow

**Description:** Wire the "Accept & Pay" button to call `/api/upload-stl` then
`/api/create-checkout`, then redirect to Stripe Checkout. Show loading state during the
upload. Handle API errors gracefully.

**Acceptance criteria:**
- [ ] "Accept & Pay" button only enabled after valid STL is parsed and name + email entered
- [ ] On click: shows loading spinner, POSTs STL to `/api/upload-stl`
- [ ] On upload success: POSTs quote details + `temp_file_id` to `/api/create-checkout`
- [ ] On checkout session created: redirects browser to Stripe checkout URL
- [ ] On any API error: shows user-friendly error message and re-enables button (retry)
- [ ] Email field validated as valid email format before submission

**Verification:**
- [ ] Full flow tested locally with Vercel dev server: upload → quote → Stripe Checkout page opens
- [ ] API error (simulated): error message shown, button re-enabled

**Dependencies:** Tasks 6, 7, 12

**Files:**
- `frontend/widget.js` (update)

**Scope:** S

---

#### Task 14: Post-payment status handling

**Description:** On return from Stripe, the widget reads `?status=` from the URL and shows
the appropriate message. Success shows order confirmation; cancelled shows the quote again
so the customer can retry.

**Acceptance criteria:**
- [ ] On `?status=success`: widget shows confirmation panel — "Payment received! Check your
  email for a confirmation from info@saguarolabs3d.com. We'll begin production shortly."
- [ ] On `?status=cancelled`: widget shows quote tool again with a message — "No charge was
  made. You can try again below."
- [ ] URL params cleaned from browser history after reading (no params visible in address bar)
- [ ] No status param: widget shows normal quote tool

**Verification:**
- [ ] Manually add `?status=success` to local test URL — confirmation shown
- [ ] Manually add `?status=cancelled` — quote tool shown with cancellation message

**Dependencies:** Task 13

**Files:**
- `frontend/widget.js` (update)

**Scope:** XS

---

#### Task 15: Manual quote fallback form

**Description:** Wire the manual quote form to POST to `/api/manual-quote`. The form is
revealed automatically when an STL fails validation or exceeds 50MB. Includes name, email,
optional note, and STL file re-upload.

**Acceptance criteria:**
- [ ] Manual quote form submits `multipart/form-data` to `/api/manual-quote`
- [ ] Shows loading state during submission
- [ ] On success: "Got it! We'll review your file and reach out to you within 1 business day."
- [ ] On error: user-friendly message, re-enables form for retry
- [ ] Form validates name and email before submission

**Verification:**
- [ ] Submit manual quote form locally — file appears in Drive Manual Quotes folder,
  owner notification email received

**Dependencies:** Tasks 9, 12

**Files:**
- `frontend/widget.js` (update)

**Scope:** S

---

### Checkpoint: Phase 3

- [ ] Full happy path tested in browser: upload STL → see price → pay → return to
  Squarespace page with success message → owner email received → file in Drive
- [ ] Failed STL path tested: invalid STL → manual form revealed → submit → owner notified
- [ ] Oversized STL tested: >50MB → message shown → manual form revealed
- [ ] Cancelled payment tested: cancel at Stripe → return with quote shown again
- [ ] Commit and push to GitHub

---

### Phase 4: Integration & Deployment

---

#### Task 16: CORS + security hardening

**Description:** Add CORS middleware to all API endpoints, restricting to the Squarespace
domain. Add input sanitization and request size limits to prevent abuse.

**Acceptance criteria:**
- [ ] All four API endpoints (`upload-stl`, `create-checkout`, `webhook`, `manual-quote`)
  return correct CORS headers for `https://www.saguarolabs3d.com`
- [ ] OPTIONS preflight requests handled correctly on all endpoints
- [ ] File upload endpoints reject requests >55MB
- [ ] `webhook.js` still processes correctly (does not need CORS — called by Stripe, not browser)

**Verification:**
- [ ] `npm test` still passes
- [ ] Browser fetch from Squarespace origin succeeds; fetch from other origin blocked

**Dependencies:** Tasks 6, 7, 8, 9

**Files:**
- `api/lib/cors.js`
- `api/upload-stl.js` (update)
- `api/create-checkout.js` (update)
- `api/manual-quote.js` (update)

**Scope:** S

---

#### Task 17: Build pipeline

**Description:** Configure esbuild to bundle `frontend/widget.js` + `frontend/widget.css`
into a single `dist/widget.min.js` file that can be loaded via a `<script>` tag on Squarespace.

**Acceptance criteria:**
- [ ] `npm run build` produces `dist/widget.min.js`
- [ ] Built file loads without errors in a plain HTML page
- [ ] Built file size is under 500KB (Three.js STLLoader loaded from CDN, not bundled)
- [ ] CSS is injected by the JS bundle (no separate CSS file required for embed)
- [ ] `vercel.json` serves `dist/widget.min.js` as a static asset

**Verification:**
- [ ] `npm run build` exits 0
- [ ] Open `tests/frontend/widget-scaffold.html` with the built script — widget renders correctly
- [ ] `ls -lh dist/widget.min.js` confirms file size under 500KB

**Dependencies:** Tasks 11–15

**Files:**
- `build.js` (esbuild config)
- `package.json` (update build script)
- `dist/widget.min.js` (generated)

**Scope:** S

---

#### Task 18: Deploy + Squarespace embed instructions

**Description:** Deploy to Vercel, configure all environment variables, verify the full
production flow, and document the single-line Squarespace embed snippet.

**Acceptance criteria:**
- [ ] `npm run deploy` deploys successfully to Vercel
- [ ] All 10 environment variables set in Vercel project settings
- [ ] Stripe webhook endpoint registered at `https://your-app.vercel.app/api/webhook`
- [ ] Google Drive service account has write access to Saguaro Labs 3D Drive folder
- [ ] Full production flow tested end-to-end (real Stripe payment in test mode)
- [ ] `docs/embed.md` contains the exact `<script>` tag and Squarespace code injection
  instructions (where to paste, which pages)

**Verification:**
- [ ] Place embed snippet on a test Squarespace page — widget loads
- [ ] Complete a Stripe test payment — STL in Drive, emails received

**Dependencies:** Tasks 16, 17

**Files:**
- `docs/embed.md`
- `vercel.json` (final review)

**Scope:** M

---

### Checkpoint: Complete

- [ ] All 18 tasks done
- [ ] `npm test` passes with 90%+ coverage on pricing + STL parser
- [ ] Full production flow verified on live Vercel deployment
- [ ] Widget live on Squarespace test page
- [ ] Owner has confirmed emails received and Drive files organized correctly
- [ ] `config.json` final values set by owner before go-live

---

## Risks and Mitigations

| Risk | Impact | Mitigation |
|---|---|---|
| Three.js STLLoader CDN unavailable | High — widget won't parse STLs | Pin to a specific CDN version; add fallback CDN URL |
| Google service account credential rotation | High — all Drive uploads fail | Document rotation procedure in `docs/embed.md`; Vercel env var update is the fix |
| Stripe webhook delivery delay | Low — owner notification delayed | Webhook is async; customer confirmation still sent. Owner can also check Stripe dashboard |
| Large STL parse time >5s in browser | Medium — poor UX | Show progress indicator during parse; set 50MB limit to bound worst case |
| Squarespace CSS conflicts with widget | Medium — broken visual | All widget CSS scoped with `.slq-` prefix; test in actual Squarespace embed early |
| Vercel free tier cold starts | Low — first request slow | Acceptable for low-volume quoting tool; warm-up not needed |
| Owner edits `config.json` incorrectly | Medium — broken pricing | Add JSON schema validation in `loadConfig()` with clear error messages |

---

## Parallelization Opportunities

Once Task 1 is complete:
- **Tasks 2 and 11** can be started in parallel (config/pricing vs. widget scaffold)
- **Tasks 3 and 4 and 5** can be started in parallel after Task 2
- **Tasks 6, 7, 9** can be started in parallel after Tasks 4 and 5
- **Tasks 12, 13, 14, 15** are sequential within the frontend but independent of backend tasks 8–10

---

## Open Questions

None — all spec questions resolved. Brand hex codes still needed before Task 11 (widget
styling), but scaffold can proceed with placeholder colors.
