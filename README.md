# TDG Cleaning – Agenda (MVP)

Minimalistische webtool (mobile-first) voor:
- Klantendatabase (CRUD + zoeken)
- Agenda (dag/week/maand) met afspraken
- Recurrenties via RRULE
- Recurrenties wijzigen: alleen deze / toekomstige / hele reeks

## Vereisten
- Node 18+ (aanbevolen 20)
- Neon Postgres database

## Installeren (lokaal)
1. Installeer dependencies:
   ```bash
   npm install
   ```
2. Maak `.env` op basis van `.env.example` en vul in:
   - `DATABASE_URL` (Neon)
   - `ADMIN_USERNAME`
   - `ADMIN_PASSWORD_HASH` (genereer met `npm run hash:password -- <PASSWORD>`)
   - `JWT_SECRET` (lange random string)
3. Prisma migrate + generate:
   ```bash
   npx prisma migrate dev --name init
   ```
4. Start:
   ```bash
   npm run dev
   ```
Open: http://localhost:3000

## Deploy (gratis)
### Neon
- Maak een gratis Neon database
- Kopieer de connection string naar `DATABASE_URL`

### Vercel
- Import project op Vercel
- Zet Environment Variables:
  - `DATABASE_URL`
  - `ADMIN_USERNAME`
  - `ADMIN_PASSWORD_HASH`
  - `JWT_SECRET`
  - `NEXT_PUBLIC_BASE_URL` (jouw vercel url, bv. https://tdg-cleaning.vercel.app)
- Build command: `npm run build`
- (Prisma) Voeg in Vercel **Build & Development Settings** toe:
  - `npx prisma generate` (Vercel draait automatisch `npm install`)
  - en gebruik `prisma migrate deploy` via Vercel “Postinstall” of via een deploy hook.

Praktisch (simpel): run migrations éénmalig lokaal tegen Neon:
```bash
DATABASE_URL="..." npx prisma migrate dev
```

## Recurrentie (RRULE)
Voorbeelden:
- Om de 2 weken: `FREQ=WEEKLY;INTERVAL=2`
- Maandelijks: `FREQ=MONTHLY;INTERVAL=1`
- Ma/wo/vr: `FREQ=WEEKLY;BYDAY=MO,WE,FR`

## Notities
- Drag&drop is bewust uitgeschakeld (klik om te wijzigen).
- Dit is een MVP. Als je wil, kunnen we RRULE-bouwer (UI) toevoegen zodat hij nooit RRULE hoeft te typen.
