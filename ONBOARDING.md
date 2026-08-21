# RijTheorie — Buyer Onboarding Checklist

Use this checklist every time a new driving school buys the application.
Total time per school: ~15–20 minutes.

---

## Step 1 — Create their Supabase project

1. Go to [supabase.com](https://supabase.com) → Log in
2. Click **"New project"** → name it the school's name
3. Wait for it to create (~1 minute)
4. Go to **Project Settings → API** → **Legacy API keys** → copy these 3 values:
   - **Project URL** → `https://xxxxx.supabase.co`
   - **anon** key → starts with `eyJ...` with `"role":"anon"`
   - **service_role** key → starts with `eyJ...` with `"role":"service_role"`

   ⚠️ Do NOT use the `sb_publishable_` or `sb_secret_` keys. Use the **Legacy JWT** keys.

---

## Step 2 — Set up the database

1. In Supabase → **SQL Editor** → paste the full contents of `supabase-schema.sql` → click **Run**
2. Open a **new query** → paste `supabase-fix-rls.sql` → click **Run**

---

## Step 3 — Create storage buckets

1. Go to **Storage** in the left sidebar
2. Click **"New bucket"**
   - Name: `question-media`
   - Toggle **Public bucket** ON
   - Click **Create bucket**
3. Click **"New bucket"** again
   - Name: `avatars`
   - Toggle **Public bucket** ON
   - Click **Create bucket**

Storage policies are included in `supabase-fix-rls.sql` — they are created automatically.

---

## Step 4 — Deploy to Netlify

1. Go to [netlify.com](https://netlify.com) → Log in
2. Click **"Add new site"** → **Import from an existing project**
3. Choose **GitHub** → select your `RijTheorie` repo
4. Build settings should already be correct (build command: `npm run build`, publish dir: `.next`)
5. **DO NOT deploy yet** — set env vars first (Step 5)

---

## Step 5 — Set environment variables

1. In Netlify → go to your new site → **Site settings → Environment variables**
2. Delete any old/duplicate entries
3. Add exactly these 4:

| Key | Value |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | The Project URL (e.g. `https://xxxxx.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | The **anon** legacy key (starts with `eyJ...`, role: anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | The **service_role** legacy key (starts with `eyJ...`, role: service_role) |
| `NEXT_PUBLIC_CLARITY_PROJECT_ID` | *(leave empty)* |

⚠️ **Double check:** the anon key has `"role":"anon"` inside the JWT. The service_role key has `"role":"service_role"` inside. They look similar — don't mix them up.

4. Go to **Deploys** → click **Trigger deploy** → **Deploy site**
5. Wait for it to finish (~2 minutes)

---

## Step 6 — Create the admin account

1. Open an **incognito window** → go to the school's site URL → `/signup`
2. Sign up with the school owner's email + password
3. Go back to Supabase → **Authentication** → **Users** → copy the user's UUID
4. Go to **SQL Editor** → run:

```sql
INSERT INTO public.profiles (id, email, name, role)
VALUES ('YOUR_UUID_HERE', 'your@email.com', 'Admin', 'admin')
ON CONFLICT (id) DO UPDATE SET role = 'admin';
```

Replace `YOUR_UUID_HERE` with the UUID and `your@email.com` with the email.

5. Clear cookies, go to `/login`, log in → should work now

---

## Step 7 — Verify

1. Open the school's site URL
2. Log in as admin
3. Create a course, add an exam, add a question
4. Log out, sign up as a student, verify the student sees the exam
5. Take the exam as a student → confirm everything works

---

## Step 8 — Copy all questions from your main database

Since each school has a separate Supabase, you need to export questions
from your main project and import them into the new school's project.

### Export from the main school

1. Go to your **main Supabase** (the one with all the questions)
2. **Table Editor** → open `questions` table
3. Click the **"..."** menu → **Download as CSV**
4. Save the file — this has all your questions, answer options, media URLs, etc.

### Import into the new school's Supabase

1. Go to the **new school's Supabase**
2. **Table Editor** → `questions` → click **"Insert rows"** → **Import from CSV**
3. Upload the CSV you downloaded
4. Map the columns and confirm

### Important notes

- Media URLs (images, videos, audio) are stored in your main school's
  Supabase Storage bucket — they won't appear in the new school because
  the URLs point to a different bucket.
- To fix this: also export the files from the `question-media` bucket
  (download them) and re-upload to the new school's `question-media` bucket.
  The media URLs in the CSV won't match, so you may need to update them
  after re-uploading.
- Alternatively: if your media URLs are public and you want to share them
  across all schools, you could use one shared Storage bucket — but this
  means all schools share the same media files.
- Exams that reference questions won't carry over automatically — you'll
  need to recreate exams in the new school and link the imported questions
  to them.
- Always run both SQL files (`supabase-schema.sql` + `supabase-fix-rls.sql`)
  in the new Supabase BEFORE importing questions.

### Shortcut for future (optional)

Write a SQL script that exports questions as JSON from one project and
inserts them into another — this avoids CSV formatting issues. Ask me
to build this when you're ready.

---

## Step 9 — Hand over to the school

Send them:
- Their login URL
- Their admin email + password (tell them to change it in Settings)
- Instructions: "Log in → go to Courses → create a course → create exams inside it → go to Questions to add questions"

---

## When you update the code

- **Code-only changes** (new features, fixes, design): push to GitHub →
  all Netlify sites rebuild automatically → every school gets the update
- **Changes that need new SQL**: push the code, then run the new SQL in
  each school's Supabase project manually (SQL files use `IF NOT EXISTS`
  and `CREATE OR REPLACE` so re-running them is always safe)
