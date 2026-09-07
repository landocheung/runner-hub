# Runner Hub

A lightweight British-English event operations app for runner check-in, massage queue management, interviews and follow-up notes.

## Current features

- Search runners by bib number or name
- One-click Check In with 24-hour time
- Massage queue with three therapist stations
- Skip / return-to-queue flow
- Interview interest captured at check-in
- Interview queue: Contact, Start, Complete, Skip and Return to List
- Dashboard with arrivals, massage history, interview history and follow-up notes
- Click any runner in the main operational lists to add/edit a note
- Shared event logo in the top-right, stored in Supabase event settings
- CSV import (`bib_number,name`)
- Supabase realtime when configured; local demo mode otherwise

## Vercel environment variables

```text
VITE_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=YOUR_PUBLISHABLE_KEY
```

For backward compatibility, the app also accepts `VITE_SUPABASE_ANON_KEY`.

## Deploying an update

Replace/update the files in the GitHub repository connected to Vercel and commit to `main`. Vercel will automatically create a new production deployment.
