# Runner Hub — Half Marathon Check-in & Massage Queue

A mobile-friendly event web app using British English throughout.

## Included
- Search runners by bib number or name
- One-tap runner check-in with automatic arrival time
- Massage queue registration
- Three therapist workstations
- Call next runner / runner not found / return to queue / complete massage
- Live event dashboard
- CSV import (`bib_number,name`)
- 24-hour British time formatting
- Supabase-backed multi-device mode with realtime refresh
- Local browser demo mode when Supabase is not configured

## Run locally
1. Install Node.js 18+.
2. In this folder run `npm install`.
3. Run `npm run dev`.
4. Open the local address shown by Vite.

Without a `.env` file the app uses browser localStorage, which is useful for demonstration on one device.

## Enable live multi-device use with Supabase
1. Create a Supabase project.
2. Open SQL Editor and run `supabase/schema.sql`.
3. Copy `.env.example` to `.env`.
4. Fill in `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` from your Supabase project settings.
5. Restart `npm run dev`.

For an actual event, protect the app behind authentication or a private staff-only access layer. The supplied SQL policies are intentionally open for rapid prototype testing and should be tightened before public deployment.

## Import runners
Use the **Import CSV** button on the Check-in page. Required columns:

```csv
bib_number,name
001,Alex Morgan
002,Jamie Chan
```

Excel files can be saved/exported as CSV before import.

## Deploy
The project is Vite-compatible and can be deployed to Vercel, Netlify or Cloudflare Pages. Add the two Supabase environment variables to the hosting provider.
