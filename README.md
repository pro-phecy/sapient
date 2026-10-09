# Sapient Mobile

A React Native Expo app for a calm, forest-toned academic workspace.

## Connect Supabase

1. Create a Supabase project and enable **Email** under Authentication providers.
2. In the Supabase SQL Editor, run [`supabase/migrations/20261008000000_slyde_backend.sql`](supabase/migrations/20261008000000_slyde_backend.sql). It creates the profile, course, class, and file metadata tables, row-level security policies, and the private `student-files` Storage bucket.
3. Copy `.env.example` to `.env` and fill in your project URL and **publishable** key. Find both in the Supabase project API settings.

   ```env
   EXPO_PUBLIC_SUPABASE_URL=https://YOUR_PROJECT.supabase.co
   EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
   ```

   Never put a `service_role` or secret key in this app. Values prefixed with `EXPO_PUBLIC_` are bundled into the client.
4. For the six-digit verification screen, configure the Supabase **Confirm signup** email template to include `{{ .Token }}`. Keep email confirmation enabled if you want new accounts to verify their address.
5. Restart Expo after changing `.env`:

   ```sh
   pnpm install
   pnpm start
   ```

The client persists Supabase sessions in the app's private file storage. Users' profiles, courses, and weekly classes sync to Postgres. Course files and timetable uploads are stored in a private Storage bucket; the app opens them using short-lived signed URLs. An authenticated Supabase account is required to use the app.

## Included flows

- Email/password account creation, six-digit email verification, and sign-in
- Onboarding tour, dashboard, weekly timetable, and manual class entry
- Course workloads and private document uploads grouped by course
- Focus timer, task list, and a locally generated study plan
- Profile and notification settings

AI timetable extraction and server-backed study tasks/sessions are not connected yet. Uploading a timetable stores the file; classes can currently be added manually.
