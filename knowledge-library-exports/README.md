# CE Board Master — Knowledge Library Export System

This folder is the **official, machine-checkable contract** for JSON exports produced
by the CE Board Master Knowledge Library and consumed by the website's Knowledge
Sync engine. It is **standalone tooling** — plain JSON + a zero-dependency Node
script. It is not part of the website's runtime (`apps/api`, `apps/web`), is not
deployed, and adds no new server, database, or dependency.

The Knowledge Library remains the single source of truth for all educational
content. This folder does not contain real content — every example record is
clearly marked `[EXAMPLE]` / `EXAMPLE-*` with `status: "draft"`, so it can never be
mistaken for production content.

## What's here

```
knowledge-library-exports/
  schemas/knowledge-library.schema.json   ← the formal JSON Schema (draft-07)
  examples/<type>.json                    ← one example record per content type
  validate.cjs                            ← validates any file against the schema
```

## How to use this

1. **Build your export** for a content type, using `examples/<type>.json` as the
   structural template (wrapper key, field names, types — copy and replace the
   `[EXAMPLE]` record with real rows).
2. **Validate before sending it anywhere:**
   ```sh
   node validate.cjs your-export.json --type=questions
   # or, if the filename already matches a type (e.g. questions.json):
   node validate.cjs questions.json
   # validate everything in examples/ at once:
   node validate.cjs --all
   ```
   No `npm install` required — only Node's built-in `fs`/`path`.
3. **Hand the validated file to the website team** (or paste/upload it into
   `/admin/knowledge-sync` → **Preview** first, then **Sync**, if you have access).

## The 12 supported content types

| File | Wrapper key | Upsert key (natural key) | Endpoint |
|---|---|---|---|
| `questions.json` | `items` | `questionCode` | `POST /admin/sync/questions` |
| `formulas.json` | `formulas` | `name` (slug auto-derived) | `POST /admin/formulas/bulk-import` |
| `diagrams.json` | `items` | `publicId` | `POST /admin/sync/diagrams` |
| `learning-objectives.json` | `objectives` | derived: `LO-<subjectCode>-<topicCode>-<subtopicCode>-<sequenceNumber>` | `POST /admin/learning-objectives/bulk-import` |
| `concepts.json` | `items` | `publicId` | `POST /admin/sync/concepts` |
| `engineering-notes.json` | `items` | `publicId` | `POST /admin/sync/engineering-notes` |
| `engineering-tips.json` | `items` | `publicId` | `POST /admin/sync/engineering-tips` |
| `misconceptions.json` | `items` | `publicId` | `POST /admin/sync/misconceptions` |
| `review-notes.json` | `items` | `publicId` | `POST /admin/sync/review-notes` |
| `flashcards.json` | `items` | `publicId` | `POST /admin/sync/flashcards` |
| `tutor-prompts.json` | `items` | `publicId` | `POST /admin/sync/tutor-prompts` |
| `mock-exam-templates.json` | `items` | `code` | `POST /admin/sync/mock-exam-templates` |

Every endpoint above also has a `/preview` variant (e.g.
`POST /admin/sync/questions/preview`) that validates and classifies rows as
new/updated/unchanged **without writing anything** — always run Preview before
Sync. All endpoints except the formula and learning-objective bulk-import accept
`{ ..., "atomic": true|false }` (default `true`): atomic mode rejects and rolls
back the entire batch if any row is invalid.

**Idempotent by design:** re-sending the same file twice never creates duplicates
— rows are matched by their upsert key and updated in place. A content-hash check
skips rows that haven't actually changed.

## Known limitations (current production contract, accurately reflected above)

1. **`learning-objectives.json` and `misconceptions.json` — `subjectCode` is
   capped at 3 characters today** (the short PRC-style code, e.g. `"STR"`), not
   the full `Subject.code` (`"STRUC"`) that every other type accepts. A widening
   fix exists in the codebase but is not yet deployed. Until it ships, use the
   3-letter code for these two types specifically.
2. **`mock-exam-templates.json` — `composition[].subjectId` requires the
   website's actual internal Subject UUID**, not a subject code (unlike
   Questions and Formulas, which both accept a code). Ask the website team for
   current Subject IDs, or wait for code-based composition support. The sync
   engine does **not** currently verify that `subjectId`/`difficultyLevelId`
   exist at sync time — an exam template built on a bad ID will only fail later,
   when a student tries to generate an exam from it. Double-check these IDs
   before sending the file.
3. **Relationship warnings vs. errors:** `formulaSlugs`, `diagramPublicIds`, and
   `learningObjective` references on a Question (and `relatedFormulaSlugs` on a
   Concept) are checked but **not required to exist** — a missing reference is a
   *warning* in the Preview report, not a failure. The row still imports; the
   link is simply skipped. Sync dependencies first (Formulas → Diagrams →
   Learning Objectives → …) and re-run Preview to confirm zero warnings before
   the final Sync.
4. **Recommended import order** within a package so references resolve cleanly:
   Formulas → Diagrams → Learning Objectives → Concepts / Engineering Notes /
   Engineering Tips / Misconceptions / Review Notes / Flashcards / Tutor Prompts
   → **Questions** → Mock Exam Templates.

## Updating this contract

If the website's backend Zod schemas change, `schemas/knowledge-library.schema.json`
must be updated to match — it is a hand-transcribed mirror, not generated
automatically. The authoritative source is always the backend code:
`apps/api/src/**/dto/*.dto.ts` and `apps/api/src/content-sync/content-sync.registry.ts`.
