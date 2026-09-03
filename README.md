# QR Guest Scanner

A production-ready event check-in app. Doorkeepers scan guest QR codes from a phone browser — no app install, no login. Admins manage the guest list and download QR tickets from a password-protected panel.

---

## Pages

| URL | Who | What |
|---|---|---|
| `/` or `/scan` | Doorkeeper | Camera scanner — no login needed |
| `/admin` | Admin | Manage guests, generate & download QRs, view scan log |
| `/login` | Admin | Password login |

---

## Quick start

### 1. Supabase setup

1. Create a project at [supabase.com](https://supabase.com)
2. Go to **SQL Editor** and run the contents of `supabase-schema.sql`
3. Go to **Project Settings → API** and copy:
   - Project URL
   - `anon` public key

### 2. Create an admin account

In Supabase Dashboard → **Authentication → Users → Invite user**, add yourself. This is the only account that can access `/admin`.

### 3. Local development

```bash
# Clone and install
npm install

# Create env file
cp .env.example .env.local
# Fill in your Supabase URL and anon key

# Start dev server
npm run dev
```

> **Important:** Camera access requires HTTPS. On localhost this works fine. On a deployed URL it's automatic.

### 4. Deploy to Vercel

```bash
# Push to GitHub, then:
# 1. Import repo on vercel.com
# 2. Add environment variables:
#    VITE_SUPABASE_URL
#    VITE_SUPABASE_ANON_KEY
# 3. Deploy
```

After deploying, go to Supabase → **Authentication → URL Configuration** and add your Vercel URL to **Redirect URLs**.

---

## How it works

### Doorkeeper flow
1. Open the app URL on a phone
2. Allow camera access
3. Point camera at a guest's QR code
4. See instant result: ✅ Valid / ⚠️ Already scanned / ❌ Invalid
5. Sound + haptic feedback on every scan
6. Auto-resets to scanning after 4 seconds

### Admin flow
1. Go to `/login`, sign in
2. Add guests manually or import via CSV
3. Click "QR code" to preview and download individual tickets
4. Click "Download all QRs" to batch download every guest's ticket
5. Send each guest their QR image (email, WhatsApp, print, etc.)
6. Monitor check-ins in real time on the Scan log tab

### CSV import format
```
name,party_size,email,notes
Jane Smith,2,jane@example.com,VIP
John Doe,1,,Plus one confirmed
```
First row must be the header row. Email and notes are optional.

---

## Scan states

| State | Sound | Haptic | Meaning |
|---|---|---|---|
| Valid | ✅ Two ascending tones | Short double pulse | First time scanning — let them in |
| Already scanned | ⚠️ Descending tone | Long single buzz | Ticket was already used |
| Invalid | ❌ Low buzzy tone | Three sharp pulses | Not on the guest list |

---

## Security model

- **Doorkeepers** use the public `anon` key. They can read guests and write scans — nothing else.
- **QR codes** encode only the guest's UUID, never personal data.
- **RLS policies** prevent doorkeepers from deleting or modifying guest records.
- **Admins** authenticate via Supabase Auth and get full access.
- **`.env.local`** is gitignored — never commit your keys.

---

## Project structure

```
src/
  pages/
    ScanPage.tsx        — Doorkeeper scanner UI
    ScanPage.module.css
    AdminPage.tsx       — Admin panel
    AdminPage.module.css
    LoginPage.tsx       — Admin login
    LoginPage.module.css
  lib/
    supabase.ts         — Supabase client singleton
    auth.tsx            — Auth context
  hooks/
    useFeedback.ts      — Sound + haptic feedback
  types/
    index.ts            — TypeScript types
  App.tsx               — Router
  main.tsx              — Entry point
  index.css             — Global styles
supabase-schema.sql     — Run in Supabase SQL editor
```
