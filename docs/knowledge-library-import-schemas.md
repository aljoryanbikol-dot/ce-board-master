# CE Board Master — Knowledge Library Import Schemas

**Status:** Official contract. The Cowork **Knowledge Library** is the single source of truth;
the website only **consumes and publishes** content via these schemas. Exports are plain JSON
and are imported **without manual editing** — adapters resolve human-readable **codes** to
internal IDs, so the Library never needs to know the website's UUIDs.

## How to export & sync

Each content type is a JSON file shaped as `{ "items": [ … ] }` (a bare `[ … ]` array also works).
Mock Exam Templates and Questions use their own wrapper keys (below). A full **package** (e.g. the
Structural Engineering pilot) is a folder/zip of one file per type.

Pipeline: **Knowledge Library → JSON export → Knowledge Sync (`/admin/knowledge-sync`) → Database
→ Question Bank → Practice → Mock Exams → AI Tutor.**

Every type supports: **upsert** (by natural key), **content-hash idempotency** (unchanged rows
skipped), **validation**, **version history**, a **sync report**, and **atomic rollback**. Use the
**Import Preview** (dry-run) before committing.

### Conventions
- **Natural key** column is the stable identifier; re-syncing the same key updates in place.
- `subjectCode` = the Subject's `code` (e.g. `STR`); `topicCode`/`subtopicCode` similar.
- `status` ∈ `draft | in_review | approved | published | deprecated | archived` (default `published`).
- `bloomLevel` ∈ `remember | understand | apply | analyze | evaluate | create`.
- Markdown + KaTeX (`$…$`, `$$…$$`) allowed in any long-text field; images via `![alt](url)`.

---

## 1. Concepts — `POST /admin/sync/concepts` · key `publicId`
```json
{ "items": [ {
  "publicId": "CON-STR-001",
  "subjectCode": "STR", "topicCode": "1",
  "title": "Normal Stress",
  "summary": "Axial stress in a prismatic member.",
  "body": "Normal stress $\\sigma = F/A$ …  (Markdown + KaTeX)",
  "bloomLevel": "understand",
  "keywords": ["stress", "axial"],
  "relatedFormulaSlugs": ["normal-stress"],
  "status": "published"
} ] }
```
Required: `publicId`, `title`, `body`. `relatedFormulaSlugs` reference Formula `slug`s (relationship-checked).

## 2. Learning Objectives — `POST /admin/learning-objectives/bulk-import` · key derived `publicId`
```json
{ "objectives": [ {
  "subjectCode": "STR", "topicCode": 1, "subtopicCode": 1, "sequenceNumber": 1,
  "statement": "Calculate normal stress in an axially loaded member.",
  "bloomLevel": "apply", "measurable": true, "keywords": ["stress"]
} ] }
```
`publicId` is built as `LO-<SUBJ>-<TOPIC>-<SUBTOPIC>-<SEQ>`. Required: `subjectCode`, `topicCode`,
`subtopicCode`, `sequenceNumber`, `statement`. Synced objectives are **published** (AI-Tutor grounding).

## 3. Formula Library — `POST /admin/formulas/bulk-import` · key `name`/`slug`
```json
{ "formulas": [ {
  "name": "Normal Stress",
  "subjectCode": "STR", "topicCode": "1",
  "expressionText": "sigma = F / A",
  "expressionLatex": "\\sigma = \\frac{F}{A}",
  "variables": [ {"symbol":"σ","name":"Normal stress","unit":"MPa"},
                 {"symbol":"F","name":"Axial force","unit":"N"},
                 {"symbol":"A","name":"Area","unit":"mm^2"} ],
  "unitsSystem": "SI",
  "derivation": "…", "limitations": "Linear-elastic, prismatic.",
  "assumptions": ["uniform stress"], "typicalApplications": ["axial members"],
  "exampleProblem": "…"
} ] }
```
Required: `name`, `subjectCode`, `expressionText`, `expressionLatex`. `slug` auto-derived from `name`.
(Adapter resolves `subjectCode` → `subjectId`.)

## 4. Diagram Library — `POST /admin/sync/diagrams` · key `publicId`
```json
{ "items": [ {
  "publicId": "DIA-STR-001",
  "subjectCode": "STR", "topicCode": "1",
  "title": "Simply supported beam — UDL",
  "description": "Free body + bending moment diagram.",
  "imageUrl": "https://cdn.ceboardmaster.com/diagrams/str-beam-udl.png",
  "altText": "Simply supported beam under uniform load with BMD",
  "caption": "Fig. 1 — M_max = wL²/8 at midspan",
  "diagramType": "free_body", "tags": ["beam"], "status": "published"
} ] }
```
Required: `publicId`, `title`, `imageUrl` (valid URL), `altText`. Questions reference diagrams by
embedding `imageUrl` in the stem (`![alt](url)`).

## 5. Engineering Notes — `POST /admin/sync/engineering-notes` · key `publicId`
```json
{ "items": [ {
  "publicId": "EN-STR-001", "subjectCode": "STR", "topicCode": "1",
  "title": "Sign conventions for bending", "body": "…(Markdown + KaTeX)…",
  "tags": ["bending"], "status": "published"
} ] }
```
Required: `publicId`, `title`, `body`.

## 6. Engineering Tips — `POST /admin/sync/engineering-tips` · key `publicId`
```json
{ "items": [ {
  "publicId": "ET-STR-001", "subjectCode": "STR", "category": "exam-strategy",
  "title": "Spot the governing load case fast", "tip": "…", "tags": ["strategy"],
  "status": "published"
} ] }
```
Required: `publicId`, `title`, `tip`.

## 7. Common Misconceptions — `POST /admin/sync/misconceptions` · key `publicId`
```json
{ "items": [ {
  "publicId": "MIS-STR-001",
  "subjectCode": "STR", "topicCode": "1", "subtopicCode": "1", "category": "GEN",
  "sequenceNumber": 1,
  "title": "Confusing stress with force",
  "description": "Students report force where stress (force/area) is asked.",
  "whyItHappens": "Units skipped.", "correction": "Always divide by area.",
  "status": "published"
} ] }
```
Required: `publicId`, `subjectCode`, `topicCode`, `subtopicCode`, `category`, `sequenceNumber`,
`title`, `description`. Codes are 3-char.

## 8. References — `POST /admin/sync/references` · key `publicId`
```json
{ "items": [ {
  "publicId": "REF-STR-001",
  "title": "Structural Analysis", "authors": ["Hibbeler, R.C."],
  "edition": "10th", "publisher": "Pearson", "publicationYear": 2018,
  "isbn13": "9780134610672", "subjectArea": "Structural"
} ] }
```
Required: `publicId`, `title`.

## 9. Review Notes — `POST /admin/sync/review-notes` · key `publicId`
```json
{ "items": [ {
  "publicId": "RN-STR-001", "subjectCode": "STR", "topicCode": "1",
  "title": "Beams — quick review", "body": "…(Markdown + KaTeX)…",
  "examWeight": 12.5, "tags": ["beams"], "status": "published"
} ] }
```
Required: `publicId`, `title`, `body`.

## 10. Flashcards — `POST /admin/sync/flashcards` · key `publicId`
```json
{ "items": [ {
  "publicId": "FC-STR-001", "subjectCode": "STR", "topicCode": "1",
  "front": "Max moment of a simply supported beam under UDL?",
  "back": "M_max = wL²/8 at midspan", "hint": "Parabolic BMD",
  "difficulty": "easy", "tags": ["beams"], "status": "published"
} ] }
```
Required: `publicId`, `front`, `back`.

## 11. AI Tutor Prompts — `POST /admin/sync/tutor-prompts` · key `publicId`
```json
{ "items": [ {
  "publicId": "TP-EXPLAIN-001", "name": "Explain question (grounded)",
  "role": "system", "category": "explanation",
  "promptText": "You are a CE board tutor. Ground every claim in the provided KB …",
  "model": "claude-opus-4-8", "tags": ["explain"], "status": "published"
} ] }
```
Required: `publicId`, `name`, `promptText`. `role` ∈ `system | user | assistant`.

## 12. Mock Exam Templates — `POST /admin/sync/mock-exam-templates` · key `code`
```json
{ "items": [ {
  "code": "STR-MOCK-1", "name": "Structural — Mock 1",
  "kind": "subject", "durationMinutes": 180, "passingScore": 70,
  "randomizeQuestions": true, "randomizeChoices": true,
  "composition": [ { "subjectCode": "STR", "count": 50, "difficultyCode": "intermediate" } ]
} ] }
```
Required: `code`, `name`, `kind`, `durationMinutes`, `composition[]`. `kind` ∈
`full_board | subject | custom | adaptive | ai_generated`. (Adapter resolves
`subjectCode`/`difficultyCode` in each composition entry → IDs.)

## 13. Questions — `POST /admin/sync/questions` · key `questionCode`
```json
{ "questions": [ {
  "questionCode": "STR-0001",
  "subjectCode": "STR", "topicCode": "1", "subtopicCode": "1", "difficultyCode": "intermediate",
  "stemText": "A simply supported beam, span $L=6$ m, UDL $w=12$ kN/m. Max bending moment?",
  "choices": [ {"letter":"A","text":"54 kN·m"}, {"letter":"B","text":"36 kN·m"},
               {"letter":"C","text":"72 kN·m"}, {"letter":"D","text":"108 kN·m"} ],
  "correctChoice": "A",
  "explanationText": "For UDL, $M_{max}=\\frac{wL^2}{8}=54$ kN·m.",
  "bloomLevel": "apply", "questionType": "computation", "estSolvingTimeSec": 120,
  "learningObjective": "LO-STR-001-001-001",
  "prcYearAppeared": [2019], "keywords": ["beam","moment"],
  "formulaSlugs": ["max-moment-udl"],
  "diagramPublicIds": ["DIA-STR-001"],
  "intelligence": { "engineeringNotes": "M=wL²/8 at midspan.",
                    "commonMistakes": ["Using cantilever formula"] },
  "status": "published"
} ] }
```
Required: `questionCode`, `subjectCode`, `topicCode`, `subtopicCode`, `difficultyCode`, `stemText`,
4 `choices`, `correctChoice`, `explanationText`. The adapter resolves all `*Code` fields → IDs,
links `formulaSlugs` (→ QuestionFormula), validates `diagramPublicIds` and `learningObjective`
(relationship warnings if missing), and upserts by `questionCode`. `status: "published"` makes the
question live in Practice and eligible for Mock Exams.

---

## Relationship resolution & warnings (adapters)
| Reference | Resolved against | If missing |
|---|---|---|
| `subjectCode` / `topicCode` / `subtopicCode` | Subjects/Topics/Subtopics | **error** (row fails) |
| `difficultyCode` | DifficultyLevel `name`/`code` | **error** |
| `formulaSlugs` (question/concept) | FormulaLibrary `slug` | **warning** (row imports; link skipped) |
| `diagramPublicIds` (question) | Diagram `publicId` | **warning** |
| `learningObjective` (question) | LearningObjective `publicId` | **warning** |

**Import order** for a package (so references resolve): Subjects/Topics/Difficulty (taxonomy) →
Formulas → Diagrams → Learning Objectives → Concepts/Notes/Tips/Misconceptions/Reviews/Flashcards →
**Questions** → Mock Exam Templates.
