# Deployment Guide

## Prerequisites

| Service | What you need |
|---|---|
| [Vercel](https://vercel.com) | Account connected to your GitHub repo |
| [Stripe](https://dashboard.stripe.com) | Live secret key + webhook secret |
| Google Workspace | Service account JSON + two Drive folders |
| Gmail (Workspace) | App password for `info@saguarolabs3d.com` |

---

## 1 — Google Drive setup

1. In Google Cloud Console, create a **Service Account** and download its JSON key.
2. In Google Drive, create two folders:
   - **Temp** — where files land before payment clears
   - **Orders** — permanent storage after payment
3. Share **both folders** with the service account email (Editor role).
4. Copy each folder's ID from its URL:
   `https://drive.google.com/drive/folders/`**`THIS_PART`**

---

## 2 — Environment variables

Set these in **Vercel → Project → Settings → Environment Variables**.
All are required for production.

| Variable | Where to find it |
|---|---|
| `STRIPE_SECRET_KEY` | Stripe Dashboard → Developers → API keys → Secret key (`sk_live_…`) |
| `STRIPE_WEBHOOK_SECRET` | Created in step 3 below (`whsec_…`) |
| `STRIPE_PUBLISHABLE_KEY` | Stripe Dashboard → API keys → Publishable key (used for reference only) |
| `GOOGLE_SERVICE_ACCOUNT_EMAIL` | `client_email` field in the service account JSON |
| `GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY` | `private_key` field in the JSON — paste the full value including `-----BEGIN...` |
| `GOOGLE_DRIVE_FOLDER_ID` | ID of your **Orders** Drive folder |
| `GOOGLE_DRIVE_TEMP_FOLDER_ID` | ID of your **Temp** Drive folder |
| `GMAIL_USER` | `info@saguarolabs3d.com` |
| `GMAIL_APP_PASSWORD` | Google Account → Security → 2-Step Verification → App passwords |
| `OWNER_EMAIL` | Your email address for order alerts |
| `SQUARESPACE_QUOTE_PAGE_URL` | Full URL of the Squarespace page where the widget lives (e.g. `https://www.saguarolabs3d.com/quote`) |
| `NEXT_PUBLIC_API_BASE_URL` | Your Vercel deployment URL (e.g. `https://sl3d.vercel.app`) — set this after the first deploy |

> **Tip — private key newlines:** Paste the `private_key` value exactly as it appears in the JSON file. Vercel preserves literal `\n` sequences; the API handler converts them to real newlines at runtime.

---

## 3 — Deploy to Vercel

### Option A — GitHub integration (recommended)

1. Push this repo to GitHub.
2. In Vercel, click **Add New Project** → import the repo.
3. Vercel auto-detects Node.js, runs `npm run build` (bundles the widget), and deploys.
4. Copy your deployment URL (e.g. `https://sl3d.vercel.app`).
5. Set `NEXT_PUBLIC_API_BASE_URL` to that URL, then redeploy.

### Option B — CLI

```bash
npm install -g vercel
vercel login
vercel --prod
```

---

## 4 — Stripe webhook

1. In the Stripe Dashboard → **Developers → Webhooks → Add endpoint**.
2. **Endpoint URL:** `https://YOUR_VERCEL_URL/api/webhook`
3. **Events to listen for:** `checkout.session.completed`
4. After saving, click **Reveal** under *Signing secret* and copy the `whsec_…` value.
5. Set it as `STRIPE_WEBHOOK_SECRET` in Vercel and redeploy.

---

## 5 — Squarespace embed

1. In Squarespace, edit the page where you want the quote tool.
2. Add a **Code Block** (Insert → More → Code).
3. Paste the following — replace `YOUR_VERCEL_URL` with your actual deployment URL:

```html
<div id="sl3d-widget"></div>
<script src="https://YOUR_VERCEL_URL/dist/widget.min.js" defer></script>
```

4. Save and preview. The widget loads the bundle from Vercel, auto-detects its own API base URL from the script `src`, and is ready to use.

> The `defer` attribute lets the page render before the widget initialises — no layout flash.

---

## 6 — Smoke test checklist

Run through this after every deploy.

**Instant quote path**
- [ ] Upload a valid STL → spinner shows → quote panel appears with a price
- [ ] Change filament or strength → price updates immediately
- [ ] Fill in name + email → "Accept & Pay" button enables
- [ ] Click "Accept & Pay" → Stripe Checkout opens with the correct amount
- [ ] Complete payment with a Stripe test card (`4242 4242 4242 4242`)
- [ ] Redirected back to `?status=success` → confirmation panel shows
- [ ] Owner notification email received at `OWNER_EMAIL`
- [ ] Customer confirmation email received
- [ ] STL moved from Temp folder to Orders folder in Drive

**Parse-fail path**
- [ ] Upload a corrupt or non-STL file → manual quote panel shows automatically
- [ ] Fill in the manual form and submit → owner alert email received

**Cancellation**
- [ ] Start checkout, click "Back" in Stripe → redirected to `?status=cancelled` → cancellation panel shows
- [ ] No charge appears in Stripe Dashboard

---

## 7 — Updating pricing

Edit `config.json` at the repo root and redeploy. All pricing parameters (filament costs, rates, margins, minimum order) live there. The widget bundle also needs a rebuild (`npm run build`) since it embeds a client-side copy of the formula for the live price preview — a `git push` triggers both automatically when GitHub integration is enabled.
