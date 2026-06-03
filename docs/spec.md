# Spec: Saguaro Labs 3D — Filament Quoting Tool

## Objective

Build a self-serve 3D print quoting tool embedded on the Saguaro Labs 3D Squarespace site.
Customers upload an STL file, receive an instant automated price quote, and pay immediately
via Stripe. On payment, the STL is saved to Google Drive and the owner is notified at
info@saguarolabs3d.com with a link to the file and full order details.

If an STL fails validation (non-watertight mesh, bad geometry, oversized file), the tool
collects the customer's contact info and the file, notifies the owner for manual quoting,
and tells the customer the owner will be in touch soon.

**Users:**
- Customers: upload STL, receive price, pay — no account required
- Owner (Saguaro Labs 3D): receives order notifications, manages config, accesses files in Drive

**Success looks like:**
- Customer uploads STL → sees price within 5 seconds → enters name/email → pays via Stripe
- Owner receives email at info@saguarolabs3d.com with order summary + Google Drive link
- Invalid STL → fallback form → owner notified with customer info + file
- Config is a single JSON file the owner can edit without touching any other code

---

## Tech Stack

| Layer | Technology |
|---|---|
| Front-end | Vanilla JavaScript + CSS (self-contained widget, no framework) |
| STL Parsing | [three.js](https://threejs.org/) STLLoader (client-side, loaded from CDN) |
| Backend | Vercel Serverless Functions (Node.js 20) |
| Payments | Stripe Checkout (redirect-based) |
| File Storage | Google Drive API v3 (via Google Workspace service account) |
| Email | Nodemailer via Gmail SMTP (Google Workspace account) |
| Hosting | Vercel free tier (API + static widget bundle) |
| Config | `config.json` — single file, all pricing parameters |

---

## Commands

```bash
# Install dependencies
npm install

# Run local development server (Vercel CLI)
npm run dev          # → vercel dev (serves API + static files locally)

# Build widget bundle for production
npm run build        # → bundles frontend/widget.js into dist/widget.min.js

# Deploy to Vercel
npm run deploy       # → vercel --prod

# Run tests
npm test             # → jest

# Lint
npm run lint         # → eslint src/ api/
```

---

## Project Structure

```
saguaro-labs-quote-tool/
├── frontend/
│   ├── widget.js          # Main quote tool — UI, STL upload, price display, form
│   ├── widget.css         # Widget styles (scoped to avoid Squarespace conflicts)
│   └── stl-parser.js      # STL volume + bounding box calculation (client-side)
├── api/
│   ├── upload-stl.js      # POST /api/upload-stl — pre-upload STL to temp Drive folder
│   ├── create-checkout.js # POST /api/create-checkout — creates Stripe Checkout session
│   ├── webhook.js         # POST /api/webhook — Stripe webhook: move file, notify owner + customer
│   ├── manual-quote.js    # POST /api/manual-quote — fallback: save to Drive, notify owner
│   └── cron/
│       └── cleanup.js     # DELETE temp Drive files >24h old with no completed payment
├── config.json            # All pricing parameters — owner edits this file
├── dist/
│   └── widget.min.js      # Built widget (deployed to Vercel, embedded in Squarespace)
├── tests/
│   ├── stl-parser.test.js
│   ├── pricing.test.js
│   └── api/
│       ├── create-checkout.test.js
│       └── manual-quote.test.js
├── docs/
│   └── spec.md            # This file
├── vercel.json            # Vercel routing + function config
├── package.json
└── .env.example           # Required environment variables (no secrets committed)
```

---

## Config File (`config.json`)

The owner edits this file to update pricing. No code changes required.

```json
{
  "filaments": [
    {
      "id": "pla",
      "name": "PLA",
      "density_g_per_cm3": 1.24,
      "cost_per_kg": 20.00
    },
    {
      "id": "petg",
      "name": "PETG",
      "density_g_per_cm3": 1.27,
      "cost_per_kg": 25.00
    },
    {
      "id": "abs",
      "name": "ABS",
      "density_g_per_cm3": 1.04,
      "cost_per_kg": 22.00
    },
    {
      "id": "tpu",
      "name": "TPU (Flexible)",
      "density_g_per_cm3": 1.21,
      "cost_per_kg": 35.00
    }
  ],
  "strength_presets": {
    "draft":    { "label": "Draft (Fast)",     "infill_pct": 10, "layer_height_mm": 0.3 },
    "standard": { "label": "Standard",         "infill_pct": 20, "layer_height_mm": 0.2 },
    "strong":   { "label": "Strong (Durable)", "infill_pct": 40, "layer_height_mm": 0.15 }
  },
  "machine_rate_per_hour": 2.50,
  "labor_rate_per_hour": 25.00,
  "overhead_rate_per_hour": 1.00,
  "support_multiplier": 1.15,
  "profit_margin_pct": 30,
  "minimum_order_usd": 10.00,
  "max_stl_size_mb": 50,
  "print_speed_mm3_per_second": 8.0
}
```

---

## Pricing Formula

```
filament_volume_cm3  = stl_volume_cm3 × infill_pct
filament_weight_g    = filament_volume_cm3 × filament_density
filament_cost        = filament_weight_g × (cost_per_kg / 1000)

print_time_hours     = filament_volume_cm3 / (print_speed_mm3_per_second × 3.6)
                       × support_multiplier  [if supports likely needed]

machine_cost         = print_time_hours × machine_rate_per_hour
labor_cost           = 0.25 × labor_rate_per_hour   [fixed 15-min setup]
overhead_cost        = print_time_hours × overhead_rate_per_hour

subtotal             = filament_cost + machine_cost + labor_cost + overhead_cost
price                = subtotal × (1 + profit_margin_pct / 100)
final_price          = max(price, minimum_order_usd)
```

Support heuristic: if any triangle normal has a Z-component below -0.5 (overhang > ~60°),
flag supports as likely needed and apply support_multiplier.

---

## Customer Flow (Happy Path)

1. Customer visits Saguaro Labs 3D Squarespace page with embedded widget
2. Selects filament type and strength preset from dropdowns
3. Uploads STL file (drag-and-drop or file picker)
4. If file exceeds 50MB: show message explaining auto-quoting is unavailable at this size,
   direct customer to the manual quote form below
5. Browser parses STL client-side — calculates volume, bounding box, support heuristic
6. Widget displays: price, estimated weight, estimated print time, selected settings
7. Customer enters name and email address
8. Clicks "Accept & Pay" — STL is uploaded to a temp Google Drive folder immediately,
   before Stripe redirect (so file is safe regardless of payment outcome)
9. Redirected to Stripe Checkout
10. On payment success: Stripe fires webhook to `/api/webhook`
11. Webhook moves STL from temp folder to permanent Orders folder, sends branded
    confirmation email to customer and notification email to owner
12. If Drive move fails/times out: owner notified with temp file link + customer contact;
    customer still receives confirmation email — no data lost

## Customer Flow (Failed STL)

1. Customer uploads STL
2. Browser detects: non-watertight mesh, file too large, or unparseable format
3. Widget shows friendly error: "Your file didn't pass our automated checks and needs to be
   manually reviewed. Submit your information below and we'll be in touch soon."
4. Customer enters name, email, optional note, re-uploads STL
5. Form POSTs to `/api/manual-quote`
6. Backend saves STL to Google Drive (`Manual Quotes/` folder), emails owner with customer
   info and Drive link
7. Customer sees confirmation: "Got it! We'll review your file and reach out to info@saguarolabs3d.com within 1 business day."

---

## API Endpoints

### `POST /api/upload-stl`
Called immediately when customer clicks "Accept & Pay", before Stripe redirect.
**Request:** `multipart/form-data` with `stl_file`, `customer_name`, `customer_email`, `quote_details`
**Response:** `{ "temp_file_id": "1abc...xyz", "temp_file_name": "..." }`
Saves STL to `Saguaro Labs 3D / Temp / {uuid}-{filename}`. Temp files older than 24 hours
with no associated completed payment are cleaned up by a scheduled Vercel cron job.

### `POST /api/create-checkout`
**Request:**
```json
{
  "customer_name": "Jane Smith",
  "customer_email": "jane@example.com",
  "filament_id": "pla",
  "strength_preset": "standard",
  "price_cents": 1540,
  "stl_filename": "bracket.stl",
  "stl_size_bytes": 204800,
  "temp_file_id": "1abc...xyz",
  "quote_details": {
    "weight_g": 42.3,
    "print_time_hours": 1.8,
    "volume_cm3": 34.1
  }
}
```
**Response:** `{ "checkout_url": "https://checkout.stripe.com/..." }`

Server re-derives price from quote_details + config to prevent client-side tampering.
`temp_file_id` is stored in Stripe session metadata for the webhook to use.

### `POST /api/webhook`
Stripe webhook (signature verified). On `checkout.session.completed`:
- Retrieve session metadata (includes `temp_file_id`)
- Move STL from `Temp/` to `Orders / YYYY-MM / {timestamp}-{customer-name}-{filename}`
- Send branded confirmation email to customer (from info@saguarolabs3d.com)
- Send notification email to owner at info@saguarolabs3d.com with Drive link + order details
- On Drive move failure: notify owner with temp file link + customer contact; send customer
  confirmation email regardless so they are not left without acknowledgement

### `POST /api/manual-quote`
**Request:** `multipart/form-data` with `name`, `email`, `note`, `stl_file`
- Save STL to Google Drive: `Saguaro Labs 3D / Manual Quotes / YYYY-MM / {timestamp}-{customer-name}-{filename}`
- Send notification email to info@saguarolabs3d.com

---

## Environment Variables

```bash
# Stripe
STRIPE_SECRET_KEY=sk_live_...
STRIPE_WEBHOOK_SECRET=whsec_...
STRIPE_PUBLISHABLE_KEY=pk_live_...

# Google Drive (service account)
GOOGLE_SERVICE_ACCOUNT_EMAIL=quote-tool@your-project.iam.gserviceaccount.com
GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY="-----BEGIN RSA PRIVATE KEY-----\n..."
GOOGLE_DRIVE_FOLDER_ID=1abc...xyz         # Root "Saguaro Labs 3D" folder ID
GOOGLE_DRIVE_TEMP_FOLDER_ID=1def...uvw   # "Temp" subfolder ID

# Email (Gmail SMTP via Google Workspace)
GMAIL_USER=info@saguarolabs3d.com
GMAIL_APP_PASSWORD=xxxx-xxxx-xxxx-xxxx

# Owner notification target
OWNER_EMAIL=info@saguarolabs3d.com

# App
NEXT_PUBLIC_API_BASE_URL=https://your-app.vercel.app
```

---

## Code Style

Vanilla JS for the front-end widget (no build framework, minimal dependencies).
Node.js for serverless functions. Async/await throughout.

```javascript
// api/create-checkout.js — example function style
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();

  const { customer_name, customer_email, filament_id, strength_preset, stl_filename, quote_details } = req.body;

  const config = await loadConfig();
  const price_cents = derivePrice(quote_details, filament_id, strength_preset, config);

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [{
      price_data: {
        currency: 'usd',
        product_data: { name: `3D Print — ${stl_filename}` },
        unit_amount: price_cents,
      },
      quantity: 1,
    }],
    mode: 'payment',
    customer_email,
    metadata: { customer_name, filament_id, strength_preset, stl_filename, ...quote_details },
    success_url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/success`,
    cancel_url: `${process.env.NEXT_PUBLIC_API_BASE_URL}/cancel`,
  });

  res.json({ checkout_url: session.url });
}
```

**Conventions:**
- `snake_case` for variables and function names
- No default exports except Vercel handler functions
- Config loaded fresh per function invocation (supports live updates)
- All money in cents (integers) internally, display in USD with two decimal places
- No inline styles in widget — all CSS in `widget.css` with `.slq-` prefix to avoid Squarespace conflicts

---

## Testing Strategy

**Framework:** Jest + jsdom for unit tests

**Coverage target:** 90% on pricing logic and STL parser; 70% overall

```
tests/
├── stl-parser.test.js      # Volume calculation with known-geometry STL fixtures
├── pricing.test.js         # Pricing formula — edge cases, minimums, multipliers
└── api/
    ├── create-checkout.test.js   # Price re-derivation, Stripe session creation (mocked)
    └── manual-quote.test.js      # File handling, Drive upload (mocked), email (mocked)
```

**Test levels:**
- **Unit:** Pricing formula, STL parser, support heuristic — fast, no I/O
- **Integration:** API endpoints with mocked Stripe + Google Drive clients
- **Manual E2E:** Squarespace embed tested in browser before each deploy (no automated E2E)

---

## Boundaries

**Always do:**
- Re-derive price server-side from quote_details + config (never trust client-sent price)
- Verify Stripe webhook signatures before processing
- Scope all widget CSS with `.slq-` prefix
- Validate STL file type and size before parsing
- Use environment variables for all secrets — never hardcode

**Ask first:**
- Adding new npm dependencies
- Changing the pricing formula
- Adding new API endpoints
- Modifying the config.json schema (existing configs must remain valid)

**Never do:**
- Commit `.env` files or any credentials to git
- Trust client-sent price_cents for the Stripe session
- Store STL files on Vercel (ephemeral filesystem — always use Google Drive)
- Skip Stripe webhook signature verification

---

## Success Criteria

- [ ] Widget loads on a Squarespace page via a single `<script>` tag embed
- [ ] STL upload + price calculation completes in under 5 seconds for files up to 50MB
- [ ] Price displayed matches the server-side re-derived price (no tampering possible)
- [ ] Stripe Checkout opens with the correct amount in USD
- [ ] STL uploaded to temp Drive folder before Stripe redirect — file safe regardless of payment outcome
- [ ] On payment success, STL moved to permanent Orders folder within 60 seconds
- [ ] On Drive move failure: owner notified with temp link + customer contact; customer still receives confirmation
- [ ] Customer receives branded confirmation email from info@saguarolabs3d.com on payment
- [ ] Owner receives notification email at info@saguarolabs3d.com with order details + Drive link
- [ ] STL files >50MB show clear message directing customer to manual quote form
- [ ] Non-watertight or unparseable STL triggers fallback form with clear error message
- [ ] Manual quote requests saved to Drive and owner notified with customer info
- [ ] All pricing parameters updatable by editing `config.json` only — no code changes
- [ ] Filament types extensible by adding a new object to the `filaments` array in `config.json`
- [ ] Pricing unit tests pass for: standard calculation, minimum price floor, support multiplier, all four filament types

---

## Open Questions

~~1. Filament types~~ — **Resolved:** PLA, PETG, ABS, TPU. Array structure supports adding more via config only.
~~2. Customer confirmation email~~ — **Resolved:** Branded HTML email from info@saguarolabs3d.com.
~~3. Widget styling~~ — **Partially resolved:** Dark industrial/minimalist matching saguarolabs3d.com. Exact hex codes to be confirmed before widget implementation (owner to provide from Squarespace Styles panel).
~~4. STL upload timing~~ — **Resolved:** Pre-upload to temp Drive folder before Stripe redirect; graceful failure handling if Drive move fails post-payment.
~~5. Oversized STL handling~~ — **Resolved:** Files >50MB show clear message directing customer to manual quote form; not auto-rejected, not silently dropped.
