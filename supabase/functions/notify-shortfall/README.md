# notify-shortfall — parent attendance-shortfall SMS

A Supabase Edge Function (Deno) that SMSes the parents of students below the
75% attendance requirement, via Twilio. Invoked from the faculty attendance
page ("Notify parents") through a staff-gated server action.

## What it does

1. Verifies the caller's JWT and that their role is `faculty` or `admin`.
2. Resolves the shortfall students for the given `courseCode` from the
   `attendance_summary` view (only rows with data and `official_pct < 75`).
3. For each: reads `profiles.parent_phone`, normalises it to E.164, builds the
   message (mirrors `lib/sms.ts`), sends it through Twilio, and writes a row to
   `public.sms_notifications` (`sent` / `queued` / `failed`).

If Twilio secrets are absent the send is a **dry run**: rows are logged as
`queued` so the whole flow is demonstrable without live credentials or spend.

## Request

```
POST /functions/v1/notify-shortfall
Authorization: Bearer <user access token>   # forwarded automatically by the app
Content-Type: application/json

{ "courseCode": "UE22CS241B" }              # or { "studentIds": ["…"] }
```

Response: `{ notified, queued, failed, total, results }`.

## Deploy

```bash
supabase functions deploy notify-shortfall

# Twilio credentials (Project Settings → Edge Functions → Secrets, or CLI):
supabase secrets set \
  TWILIO_ACCOUNT_SID=ACxxxxxxxx \
  TWILIO_AUTH_TOKEN=xxxxxxxx \
  TWILIO_FROM_NUMBER=+1xxxxxxxxxx
# For India, prefer a Messaging Service bound to your DLT sender:
#   TWILIO_MESSAGING_SERVICE_SID=MGxxxxxxxx
```

`SUPABASE_URL`, `SUPABASE_ANON_KEY` and `SUPABASE_SERVICE_ROLE_KEY` are
injected by the platform automatically.

Apply migration `0009_sms_notifications.sql` first (creates the log table).

## India / TRAI–DLT compliance (important)

SMS to Indian numbers requires a **DLT-registered sender (header)** and a
**registered template**. Steps:

1. Register your entity + a **sender ID** on your operator's DLT portal.
2. Register a **content template** whose text matches
   `buildShortfallMessage()` (e.g. `Dear Parent, your ward {#var#} has {#var#}%
   attendance in {#var#}, below the 75% requirement. Please ensure regular
   attendance. - PES University`).
3. In Twilio, create a **Messaging Service** using your DLT sender and set
   `TWILIO_MESSAGING_SERVICE_SID`.

Without DLT registration, Indian carriers will reject the traffic even though
the Twilio API call succeeds.

## Local testing

```bash
supabase functions serve notify-shortfall --env-file supabase/functions/.env.local
```
