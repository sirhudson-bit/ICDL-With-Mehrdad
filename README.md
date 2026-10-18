# ICDL With Mehrdad

An interactive, fully Persian (RTL) learning platform for the ICDL syllabus, built for
absolute beginners. Every lesson is data-driven, so the administrator can rewrite the
curriculum, add interactive exercises, quizzes and FAQs entirely from the admin panel —
without touching source code.

---

## Quick start

```bash
npm install            # NODE_ENV must not be production, or use: npm install --include=dev
cp .env.example .env   # then set AUTH_SECRET (see below)
npm run setup          # prisma generate + db push + seed
npm run dev            # http://localhost:3000
```

`npm run setup` creates the SQLite database and loads the full curriculum
(9 modules, 13 chapters, 56 lessons, 842 content blocks, 189 quiz questions, 12 help
articles) plus demo accounts.

### Seeded accounts

| Role    | Email                | Password       |
| ------- | -------------------- | -------------- |
| Admin   | `mehrdad@icdl.local` | `Mehrdad@1398` |
| Learner | `learner@icdl.local` | `Learner@1398` |

Change these before deploying. They can be overridden with `SEED_ADMIN_EMAIL`,
`SEED_ADMIN_PASSWORD`, `SEED_LEARNER_EMAIL` and `SEED_LEARNER_PASSWORD` when seeding.

---

## Scripts

| Script               | Purpose                                            |
| -------------------- | -------------------------------------------------- |
| `npm run dev`        | Development server                                 |
| `npm run build`      | `prisma generate` + production build               |
| `npm start`          | Serve the production build                         |
| `npm run typecheck`  | `tsc --noEmit`                                     |
| `npm run lint`       | ESLint (Next core-web-vitals + TypeScript rules)   |
| `npm run db:push`    | Apply the schema to the database                   |
| `npm run db:seed`    | Load curriculum and demo data (idempotent)         |
| `npm run db:reset`   | Force-reset the schema and re-seed                 |
| `npm run db:studio`  | Prisma Studio                                      |

---

## Switching to PostgreSQL

The schema is deliberately written to be portable: **no `enum` declarations** and **no
native type attributes** (`@db.Text`, `@db.VarChar`), because SQLite supports neither.
Enumerated values are stored as strings and narrowed by TypeScript unions and Zod
schemas, so the same code runs on both engines.

To move to PostgreSQL:

1. In `prisma/schema.prisma`, change the datasource provider:

   ```prisma
   datasource db {
     provider = "postgresql"
     url      = env("DATABASE_URL")
   }
   ```

2. Point `DATABASE_URL` at your server:

   ```
   DATABASE_URL="postgresql://USER:PASSWORD@localhost:5432/icdl?schema=public"
   ```

3. Run `npm run db:migrate` (creates and applies a migration), then `npm run db:seed`.

One behavioural note: `mode: "insensitive"` is PostgreSQL-only and is therefore never
used. Persian is caseless, and Latin text is lower-cased into the normalised
`searchText` columns at write time, so search behaves identically on both engines.

---

## How it is put together

```
src/
  app/
    (site)/          learner-facing pages (home, course, lesson, search, help, …)
    (auth)/          login and registration, with their own minimal layout
    admin/           admin panel (dashboard, structure, users, settings, data)
    actions/         server actions — the only write path for content and progress
    api/             route handlers: search, suggestions, chat, progress, bookmarks
  components/
    ui/              design-system primitives and accessible overlays
    lesson/          lesson renderer, step viewer, bookmarks, checklist
    exercise/        exercise runner plus the environment simulators
    quiz/            quiz runner and result review
    chat/            lesson-aware assistant
    admin/           content builder, generic field editor, charts, forms
    layout/          header, sidebar, mobile navigation, footer
  lib/
    content/         block contracts (Zod) and builder field descriptors
    ai/              provider-agnostic AI layer (context, providers)
    search/          query highlighting and snippet extraction
    auth/            password hashing and database-backed sessions
    persian.ts       normalisation, digits, Jalali dates, RTL helpers
    sanitize.ts      rich text allow-list
  services/          data access: course, progress, quiz, bookmark, search, stats,
                     settings, chat, content maintenance
prisma/
  schema.prisma      data model
  content/           the curriculum as typed, reviewable data
  seed.ts            validation + loading pipeline
```

### Content model

A lesson is an ordered list of typed blocks. There are 24 block types (heading, rich
text, definition, callout, tip, warning, example, image, gallery, video, table, keyboard
shortcuts, code, step-by-step, practice, interactive exercise, demo, quiz anchor, FAQ,
resources, summary, related lessons, objectives, divider). Every payload is validated
with Zod **on write**, so the admin builder, the importer and the seed script cannot
produce content the renderer does not understand.

Interactive exercises support ten kinds: multiple choice, true/false, fill in the blank,
matching, ordering, spreadsheet formulas (with a real formula evaluator), document
formatting, browser tasks, file-manager tasks and email composition. Six explorable
simulators cover the Windows desktop, File Explorer, Word, Excel, the browser and
PowerPoint.

### The admin panel can change almost everything

- **Structure** — modules, chapters and lessons: create, rename, reorder, publish,
  unpublish, delete.
- **Content** — drag-and-drop block builder with a generated form for every block type:
  no JSON, no code.
- **Assessment** — quizzes and questions of five types, with visual editors.
- **Users** — roles, activation, progress reset, account deletion.
- **Settings** — site identity, appearance, home page composition, course copy, footer,
  chatbot, search and registration policy.
- **Data** — export the whole curriculum as structured JSON and import it again.
- **Preview** — render any lesson, including drafts, at desktop/tablet/mobile widths.

### Search

Search runs against normalised `searchText` columns maintained on every write
(`services/content-service.ts`). Persian normalisation unifies Arabic/Persian letter
variants, strips diacritics, treats the zero-width non-joiner as a space, and converts
Persian digits to ASCII — so «میروم» matches «می روم», and «۱۲۳» matches «123».
Results are ranked by title match, body match and content type.

`services/search-service.ts` defines a `SearchProvider` interface with a database-backed
implementation. A dedicated engine (Meilisearch, Elasticsearch) can be added by
implementing that interface and switching the `search.provider` setting — no changes
elsewhere in the application. The `meilisearch` option is present in settings but not yet
implemented; selecting it logs the misconfiguration and keeps using the database
provider rather than silently returning nothing.

### The AI assistant

```
Chat UI → /api/chat → chat-service → AIProvider
```

- `OpenAICompatibleProvider` talks to any OpenAI-compatible chat-completions endpoint
  (OpenAI, Azure, OpenRouter, Groq, Ollama, …), configured entirely from the admin panel.
- `LocalKnowledgeProvider` answers **offline** from the lesson content itself. It
  detects intent (simplify, example, step-by-step, give me an exercise, summarise,
  define) and grounds every answer in an authored passage, so it never invents facts.
  This is the default, which means the chatbot works with no API key at all.
- Remote provider failures fall back to the offline provider instead of showing an error.
- The current lesson's module, chapter, title, body text, steps, definitions, tips,
  warnings, practice tasks and FAQs are injected into the prompt, which is what lets the
  assistant answer about the page the learner is actually reading.

### Security

- Passwords hashed with scrypt (Node's built-in, memory-hard) in the format
  `scrypt$salt$key`; verification is constant-time.
- Sessions are database-backed; the browser holds an opaque random token and the
  database stores only its SHA-256 hash. Cookies are `httpOnly`, `sameSite=lax`, and
  `secure` in production.
- Role checks run on the server in the admin layout and inside every admin server action
  — hiding a control in the UI is never the boundary.
- Rich text is sanitised against an allow-list on the server before rendering, and JSON-LD
  is escaped so it cannot break out of its `<script>` tag.
- In-memory rate limiting on login, registration, search and chat.
- Input validation with Zod on every write path; users get Persian messages, technical
  detail is logged server-side only.

---

## Environment variables

| Variable                                   | Required | Notes                                            |
| ------------------------------------------ | -------- | ------------------------------------------------ |
| `DATABASE_URL`                             | yes      | `file:./dev.db` locally, PostgreSQL in production |
| `AUTH_SECRET`                              | yes      | 32+ random bytes; **must** be changed in production |
| `SESSION_MAX_AGE_DAYS`                     | no       | Defaults to 30                                   |
| `NEXT_PUBLIC_SITE_URL`                     | no       | Used for canonical URLs, sitemap, Open Graph      |
| `NEXT_PUBLIC_SITE_NAME`                    | no       | Fallback site name before settings load           |
| `ALLOW_REGISTRATION`                       | no       | Initial value; overridable in the admin panel      |
| `AI_PROVIDER`, `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`, `AI_TEMPERATURE`, `AI_MAX_TOKENS` | no | Optional chatbot defaults; the admin panel is preferred |

Generate a secret with:

```bash
node -e "console.log(crypto.randomBytes(48).toString('base64url'))"
```

---

## Known limitations

- The Meilisearch search adapter is a declared seam, not an implementation (see above).
- Rate limiting is per-instance and in-memory; a multi-instance deployment should back
  `checkRateLimit` with Redis behind the same signature.
- Media is referenced by URL rather than uploaded to local storage; the `Media` table and
  picker exist, but no upload endpoint is wired up yet.
- Self-reported practical quiz answers are checked against a checklist, so they measure
  completion rather than correctness.

---

## Troubleshooting: "Failed to start server"

Next.js 16 allows only **one dev server per project directory**. If one is already
running — or a previous one was killed uncleanly and left its lock behind — `npm run dev`
fails with:

```
⨯ Another next dev server is already running.
⚠ Port 3000 is in use by process <PID>, using available port 3001 instead.
```

The cause is a leftover process or lock, not the project. Recover with:

```bash
# 1. See what is holding the port (Windows)
netstat -ano | findstr :3000 | findstr LISTENING

# 2. Stop it — the dev server prints its own PID on startup
taskkill /PID <PID> /F

# 3. Clear the stale dev lock, then start again
rmdir /s /q .next
npm run dev
```

On macOS/Linux use `lsof -i :3000` to find the PID and `kill <PID>` to stop it.

Two other things worth knowing:

- **Only run one server at a time.** `npm run dev` and `npm start` both bind port 3000.
- **`NODE_ENV` should not be set manually.** If your shell exports `NODE_ENV=production`,
  Next prints a "non-standard NODE_ENV" warning. It still starts, but `npm install` then
  skips `devDependencies`, so lint and `tsx` (used by the seed) would be missing. Unset it
  with `set NODE_ENV=` (Windows) or `unset NODE_ENV` before installing.

### `npm run build` fails with EPERM on the Prisma engine

On Windows, `npm run build` **cannot run while `npm run dev` is running**:

```
Error: EPERM: operation not permitted, rename
'...node_modules\.prisma\client\query_engine-windows.dll.node.tmp7076'
-> '...node_modules\.prisma\client\query_engine-windows.dll.node'
```

The build script starts with `prisma generate`, which replaces that DLL — and the running
dev server has it loaded, so Windows refuses the rename. Stop the dev server first:

```bash
# stop the dev server (Ctrl+C, or taskkill /PID <pid> /F)
npm run build
npm start
```

If you need a production build while leaving a dev server up, you can skip the redundant
regeneration (the client is already generated unless `prisma/schema.prisma` changed):

```bash
npx next build
npx next start -p 3100   # a spare port, so it does not collide with the dev server
```

Also note that `npm run dev` and `npm start` both bind port 3000, so only one of them can
run at a time unless you pass `-p`.

### "My code changes don't appear"

`npm start` serves the **compiled build in `.next`**, not your source files. Editing a file
and refreshing the browser changes nothing until you rebuild:

```bash
# stop the server, then:
npm run build
npm start
```

Two other things that produce the same confusing symptom:

- **A `next start` process caches the build it booted with.** If you rebuild while it is
  running, it keeps serving the old build until you restart it.
- **Hard-refresh the browser** (`Ctrl+Shift+R`) after a rebuild, in case the HTML document
  itself came from cache.

While you are actively editing, prefer `npm run dev`: it compiles on demand, so a normal
refresh always shows your latest code and no rebuild step is needed.
