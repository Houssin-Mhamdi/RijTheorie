## Goal
- Build a full-stack Next.js theory learning platform (RijTheorie Pro) with Supabase backend, admin dashboard, student learning view, and exam-taking interface.

## Constraints & Preferences
- All icons use Lucide React, not Material Symbols.
- Video thumbnails captured client-side via `useVideoPoster` hook (canvas capture of first frame).
- Exam-taking page uses no sidebar (standalone layout via `[id]/layout.tsx`).
- Hotspot questions (Right of Way) use numbered draggable circles (1–4) on image/video instead of A/B/C/D multiple choice.
- Student must answer a question before clicking "Volgende" — inline error with `AlertCircle` icon shows if unanswered.
- Choose Images category stores multiple image URLs in `answerOptions[].imageUrl`; student clicks image to answer with green/red border feedback.
- Admin role now allowed to access `/exams` routes.
- Student view redesigned as mobile-app-like: no admin TopBar (search/bell/help), compact sticky headers, touch-friendly sizes, press feedback scales; responsive on desktop with sidebar + question palette.
- Correct answers (`isCorrect`, hotspot `x`/`y`, explanations) never sent to client — stripped server-side by SECURITY DEFINER RPCs.
- TopBar shows email initials circle avatar with dropdown (Profiel, Instellingen, Uitloggen). Settings page at `/dashboard/settings` allows profile picture upload, name change, password change, and site name change.

## Progress
### Done
- Supabase project connected: URL and anon key in `.env.local`, client in `src/lib/supabase.ts`.
- SQL schema in `supabase-schema.sql` + `supabase-fix-rls.sql`: profiles, lessons, user_progress, questions, courses, exams, exam_questions tables; auto-signup trigger; `is_admin()` SECURITY DEFINER; RLS policies; `last_active_at` column on profiles.
- Auth hooks (`src/hooks/use-auth.ts`): `useSession`, `useProfile`, `useLogin`, `useSignup`, `useLogout` — TanStack Query mutations.
- Login page (`/login`) and Signup page (`/signup`): direct routes, Zod + react-hook-form.
- Auth schemas (`src/lib/auth-schemas.ts`): login, signup, lesson, question, course, exam schemas + types; `answerOptions` schema extended with optional `imageUrl` field.
- Database types (`src/types/database.ts`): Profile, Lesson, LessonFormData, UserProgress; `last_active_at` added to Profile.
- Proxy (`src/proxy.ts`): route protection, role-based redirects via direct REST API call for profile check; allows admin on `/exams`.
- DashboardShell, Sidebar, TopBar, MobileBottomNav, DataTable, SlideOver, Drawer, Dialog, Button, TipTapEditor.
- DashboardShell now supports `hideTopBar` prop.
- Questions page (`/questions`): CRUD with SlideOver + QuestionForm, Supabase persistence, image/video upload to `question-media` bucket.
- QuestionForm: Zod + RHF validation, interactive hotspot mode for "Right of Way" category, `initialData` prop for editing, Choose Images mode (multiple image upload with correct/wrong toggle), Ranking removed.
- ImageHotspot component: draggable numbered circles on uploaded image, stores x/y percentages.
- VideoHotspot component: video plays for configurable duration (default 3s), auto-pauses, draggable numbered circles on frozen frame.
- Choose Images category: admin uploads multiple images via `multiple` file input, each becomes an option with `imageUrl`, toggle correct/wrong; student sees 2-3 column image grid with green/red border + CORRECT/JOUW KEUZE badges.
- Courses page (`/lessons`): grid of course cards, SlideOver add/edit, toggle active/inactive; `studentCount` now dynamically counts student profiles instead of reading static `student_count` column.
- Course detail page (`/lessons/[id]`): exam list, create/delete exams, SlideOver + ExamForm.
- ExamForm: title + optional description + free access toggle.
- Exam detail page (`/lessons/[id]/exam/[examId]`): questions in exam, bulk add via slide-over panel, remove with confirmation Dialog, **drag-and-drop reorder** with `handleReorder` updating `sort_order` via Supabase `upsert`.
- Supabase Storage bucket `question-media` with RLS (public read, authenticated upload, owner/admin delete).
- Students page (`/students`): real data from Supabase (student profiles, progress stats, total exams count, avg progress, pass rate); "Last Active" column with relative time instead of "Joined"; stats cards show real calculations.
- `useActiveTracking` hook (`src/hooks/use-active-tracking.ts`): updates `profiles.last_active_at` on mount then every 5 min; wired into `DashboardShell`.
- Exams list page (`/exams`): redesigned mobile-app look — compact header, full-width cards with press feedback (`active:scale-[0.98]`), gradient review CTA; hideTopBar enabled; accessible by admins.
- `/api/auth/role` API route: reads Supabase auth cookie, validates session, returns `{ role }`.
- `/results` page: student-only with stats cards and exam history.
- Student sidebar/exams layout: hides admin TopBar, uses `studentNavItems`, `studentMobileNavItems`, `bottomItems={[]}`.
- Landing page "Inloggen" button navigates to `/login`, "Gratis starten" to `/signup` via `router.push`.
- **Security fix — answers hidden from Network tab**: `questions` RLS changed from public-read to admin-only; 3 SECURITY DEFINER RPCs created (`get_exam_questions`, `check_answer`, `check_hotspot`); exam page fetches via RPCs instead of direct queries; `isCorrect` stripped from answer_options client-side; `explanation` only returned from `check_answer` after submission; `validationResults` prop added to StudentHotspot; `isCorrect` removed from `AnswerOption` and `HotspotOption` types.
- `supabase-fix-rls.sql` now includes: `UPDATE` policy for `exam_questions`, `SELECT` policy for admin on `user_progress`, `last_active_at` migration, admin-only questions policy, and all 3 RPC functions.
- SQL uses `public.questions`/`public.exam_questions` fully qualified names (required by `SET search_path = ''`); `^` operator replaced with multiplication for PostgreSQL compatibility.
- **"Toon resultaat" button + results review page**: on the last exam question, when answered, shows a green "Toon resultaat" button instead of disabled "Volgende". Results page shows score card (correct/total, percentage bar, time), plus scrollable list of all questions with correct/incorrect indicators, CORRECT/JOUW KEUZE badges, and explanations. "Terug naar overzicht" button navigates back to exam list.
- **Simplified category scores**: `exam_attempts` has a `category_scores JSONB` column instead of a separate `exam_category_scores` table. Category stats are computed client-side and stored inline on the attempt record via `finish_exam_attempt` RPC. No separate table, RPC, or API route needed.
- **Global multi‑language system**: Admin defines supported languages in Settings (`site_settings.languages` JSONB). Student picks language in profile (`profiles.language`). QuestionForm auto‑renders translation fields for all global languages (no per‑question picker, no "Show in exam" checkbox). Exam page auto‑selects translation from profile language (no language picker in header). `translationEntrySchema` `active` field removed.

### In Progress
- (none)

### Blocked
- (none)

## Key Decisions
- `supabase.ts` uses `createBrowserClient` in browser and `createClient` during SSR — detected by `typeof document !== "undefined"`.
- Proxy uses `createServerClient` with direct REST API role check (fetch with `Authorization: Bearer <token>`).
- `/api/auth/role` bypasses Supabase client auth context issues by making direct REST API call with access token.
- RLS uses `SECURITY DEFINER` function `is_admin()` to avoid infinite recursion.
- DashboardShell no longer checks role — proxy handles all role-based redirects.
- DashboardShell accepts `hideTopBar` prop for student-facing pages.
- `/exams` list uses DashboardShell with student nav items + hideTopBar; `/exams/[id]` uses a clean `<>{children}</>` layout.
- Correct answers are never exposed client-side: 3 SECURITY DEFINER RPCs strip `isCorrect` and validate server-side; questions table RLS blocks student direct reads.
- `last_active_at` tracked via client-side hook (mount + 5min interval) wired into DashboardShell — no server request per navigation.
- Student count on courses page dynamically counts `profiles WHERE role = 'student'` — ignores static `student_count` column.
- Hotspot answer persistence: parent stores positions in `hotspotAnswers` state and passes `initialPositions`/`initialSubmitted` to StudentHotspot — avoids losing dragged circle state on Vorige/Volgende navigation.
- StudentHotspot uses `positionsRef` to pass latest positions to `onComplete` callback — avoids stale closure issues during drag.
- Video poster captured at 3s (`VIDEO_PAUSE_AT`) instead of frame 0 — shows the relevant scene where circles are positioned.
- Gray target circles in StudentHotspot conditionally rendered only when `paused` is true (video) or always (image) — avoids visual clutter during playback.
- Exam question reorder uses `upsert` with `onConflict: "id"` including all NOT NULL fields (`question_id`, `exam_id`) to avoid constraint violations.
- Answered count uses `Object.keys(submitted).length` (not `answers`) — correctly counts hotspot and any future non-indexed question types.
- Mobile-app student design: exam list uses full-width cards with `active:scale-[0.98]` press effect; exam-taking uses compact sticky header, pill timer, `active:scale-[0.99]` on options, custom bottom buttons (not Button component).
- Results view renders inline in the same page (no separate route) — shows score card with percentage + progress bar, and a scrollable list of all questions with correct/incorrect status, answer badges, and explanations.

## Next Steps
- Add sound effects for correct/incorrect answers.
- Build actual theory lesson content in Supabase lessons table.
- Address remaining React Doctor issues: `prefer-useReducer` (questions/page.tsx, question-form.tsx), accessibility (`text-sx` → `text-xs`), maintainability (`flex-col` on `CardContent`).
- Clean up unused `Globe` import from exam page after language picker removal.

## In Progress
- (none)

## Blocked
- (none)

## In Progress
- (none)

## Blocked
- (none)

## Critical Context
- `@supabase/ssr` does not export `createMiddlewareClient` — use `createServerClient` in proxy with manual cookie `getAll()`/`setAll()`.
- `createBrowserClient` from `@supabase/ssr` fails during SSR — guard with `typeof document !== "undefined"`.
- Proxy matcher: `/dashboard/:path*`, `/learn/:path*`, `/questions/:path*`, `/lessons/:path*`, `/students/:path*`, `/exams/:path*`, `/results/:path*`, `/login`, `/signup`, `/`.
- Questions DB schema: columns `question_text` (not `title`), `answer_options` (not `options`), `media` (not `media_url`), `explanation`, `category`.
- **Security**: `questions` table RLS is admin-only. Students may NOT read directly. All exam question data flows through SECURITY DEFINER RPCs (`get_exam_questions`, `check_answer`, `check_hotspot`) which strip `isCorrect` from answer_options. `explanation` only returned after answer submission. RPCs use `SET search_path = ''` and fully qualified `public.` table names.
- PostgreSQL does not support `^` as exponentiation — use multiplication or `POWER()`.
- Student hotspot state persistence bug fixed with `key={currentQuestion.id}` — forces React to remount component per question.
- Hotspot answer persistence: `hotspotAnswers[questionId]` stores `{ positions }` in exam page; `StudentHotspot` receives `initialPositions`/`initialSubmitted` to restore saved state on remount.
- Choose Images options use `imageUrl` field alongside `text`/`isCorrect` in the `answer_options` JSONB column.
- `Dragging.current` ref null in `handlePointerMove` setState callback fixed by capturing to local `drag` variable before closure.
- React "hooks order changed" error fixed by moving all `useCallback` hooks before any early return (`if (loading)`, `if (error)`, `if (!currentQuestion)`).
- "Router action dispatched before initialization" is a Next.js 16 dev-mode HMR issue — not caused by app code.
- `answeredCount` must use `Object.keys(submitted).length` instead of `Object.keys(answers).length` — hotspot questions don't set `answers`, only `submitted`.
- Exam question reorder: `upsert` payload must include `question_id` and `exam_id` to avoid NOT NULL constraint violation on `exam_questions.question_id`.
- Proxy now allows admin role (`role !== "student" && role !== "admin"`) to access student routes — previously only student role was allowed.
- `supabase-fix-rls.sql` must be fully re-run on a fresh DB — contains the `is_admin()` function and all policy fixes.
- `exam_attempts` has a `category_scores JSONB` column — stores per-category results inline. No separate `exam_category_scores` table.
- Results view uses `correctCount` computed from `answerResults` + `hotspotResults` state; `currentQuestion` is guaranteed non-null by the `if (!currentQuestion && !showResults) return null` guard.
- **Global multi‑language**: Admin defines supported languages in Settings (`site_settings.languages` JSONB). Student picks language in profile (`profiles.language`). QuestionForm auto‑renders translation fields for all global languages (no per‑question picker, no "Show in exam" checkbox). Exam page auto‑selects translation from profile language (no language picker in header).
- `translationEntrySchema` has no `active` field.
- `Translations` type on exam page has no `active` field.

## Relevant Files
- `src/app/exams/[id]/page.tsx`: Exam-taking page — timer, RPC-based question fetch, multiple choice + hotspot + Choose Images with server-side validation, explanations from RPC, Vorige/Volgende, `key={currentQuestion.id}` fix, `hotspotAnswers`/`answerResults`/`hotspotResults` state, `showResults` toggle, "Toon resultaat" button on last answered question, full results review view with score card + question list + explanations.
- `src/app/exams/[id]/layout.tsx`: Clean layout (`<>{children}</>`) — no sidebar during exam.
- `src/app/exams/(list)/page.tsx`: Exam selection list — mobile-app design, hideTopBar, full-width cards with press feedback, gradient CTA section.
- `src/app/exams/(list)/layout.tsx`: Uses DashboardShell with student nav items + hideTopBar.
- `src/components/questions/student-hotspot.tsx`: Student hotspot — draggable numbered circles, gray target rings, snap-to-target, `initialPositions`/`initialSubmitted`/`validationResults` props, `onComplete(positions)` callback, `positionsRef` for stale-closure safety.
- `src/hooks/use-active-tracking.ts`: Updates `profiles.last_active_at` on mount + every 5 min; wired into DashboardShell.
- `src/hooks/use-video-poster.ts`: Captures video frame at configurable `seekTime` (default 0) as poster data URL via offscreen canvas.
- `src/components/dashboard/dashboard-shell.tsx`: Added `hideTopBar` prop, calls `useActiveTracking()`.
- `src/app/students/page.tsx`: Real student data from Supabase — profiles, progress, exams, stats; "Last Active" column with relative time.
- `src/app/lessons/page.tsx`: Courses overview — student count now dynamically counts profiles.
- `supabase-fix-rls.sql`: All policies + `last_active_at` migration + 3 RPC functions — run this fully.
- `supabase-schema.sql`: Schema including `last_active_at` column, admin-only questions RLS, 3 RPC functions.
- `src/types/database.ts`: `last_active_at: string | null` added to Profile.
- `src/app/exams/(list)/statistics/page.tsx`: Student statistics page — Radar chart per category, stats cards, recent exams list; fetches from `/api/exam/stats`.
