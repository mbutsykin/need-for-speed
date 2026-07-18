# Styleguide

Conventions for this monorepo. Most formatting is automated; a few things are
left to reviewer judgment because they can't be mechanically enforced without
false positives.

## Formatting is automated

Prettier owns formatting. Don't hand-format — run it instead:

```sh
pnpm format        # write
pnpm format:check  # verify, used in CI-style checks
```

Key settings (`.prettierrc.json`):

- Double quotes.
- `printWidth: 100`.
- Trailing commas everywhere (`"all"`).
- Import sorting via `@ianvs/prettier-plugin-sort-imports`, grouped as:
  1. Node builtins + third-party packages
  2. _(blank line)_
  3. Parent imports (`../...`)
  4. _(blank line)_
  5. Same-folder imports (`./...`)

## Vertical breathing room

Separate logical steps with a blank line. A function body is easier to scan
when declarations, the main logic, and the result are visually distinct
blocks rather than one dense run of statements.

The pattern:

- A block of declarations (`const`/`let`/`var`), then a blank line before the
  main logic (a loop, a branch, the core computation).
- Guard clauses (`if (...) return;`, `if (...) continue;`, `if (...) throw;`)
  get a blank line before them (separating them from prior statements) and a
  blank line after them (separating them from what follows), unless the guard
  is the very first or very last statement in its block.
- A blank line before the final `return`.

**Before:**

```ts
export function normalizeMainInfo(raw: RawMainInfo): TimingSnapshot {
  const { onTablo } = raw;
  const teams: SnapshotTeam[] = [];
  for (const team of onTablo.teams) {
    const kart = parseKartNumber(team.number);
    if (kart === null) continue;
    teams.push({ kart, pilotName: team.pilotName, lapCount: parseCount(team.lapCount) });
  }
  return { raceStartedAt: onTablo.raceStartedButtonTimestamp, teams };
}
```

**After:**

```ts
export function normalizeMainInfo(raw: RawMainInfo): TimingSnapshot {
  const { onTablo } = raw;
  const teams: SnapshotTeam[] = [];

  for (const team of onTablo.teams) {
    const kart = parseKartNumber(team.number);

    if (kart === null) continue;

    teams.push({ kart, pilotName: team.pilotName, lapCount: parseCount(team.lapCount) });
  }

  return { teams, raceStartedAt: onTablo.raceStartedButtonTimestamp };
}
```

### What ESLint enforces vs. what's reviewer judgment

ESLint (`padding-line-between-statements`) mechanically enforces two parts of
this pattern, repo-wide, under `apps/**/*.ts`:

- A blank line is **required before every `return`**.
- A blank line is **required after a block of `const`/`let`/`var`
  declarations** (i.e. before the first non-declaration statement that
  follows them). Consecutive declarations may stay tight against each other
  (no blank line required between them).

Everything else in this section — blank lines around guard clauses in the
middle of a function, and generally judging when a group of statements reads
as "a step" that deserves separation — is **reviewer judgment**, not
mechanically enforced. Apply it where it clearly improves readability; don't
force it into single-statement functions or trivial one-liners.

## Property/field ordering (soft guidance, not enforced)

When constructing or declaring an object with related fields, group related
fields together and keep pairs adjacent — e.g. keep sector times `s1`/`s2`
next to each other, keep lap-related fields (`lapCount`, `lastLapTime`)
together, rather than interleaving unrelated fields between them. This is a
readability nicety, not a rigid rule: use judgment, and don't churn existing
code just to satisfy it.

## Dashboard app structure (`apps/dashboard`)

Pages and components are split at the top level; every component lives in
its own folder:

- **`src/pages/<PageName>/`** — one PascalCase folder per routed page,
  holding the page component, its co-located spec, page-private modules,
  and an `index.ts` barrel:

  ```
  src/pages/
  ├── SessionsPage/
  │   ├── SessionsPage.tsx
  │   ├── search-params.ts        # page-private module
  │   ├── search-params.spec.ts
  │   └── index.ts
  ├── TrackPage/
  │   ├── TrackPage.tsx
  │   └── index.ts
  └── TracksPage/
      ├── TracksPage.tsx
      ├── TracksPage.spec.tsx
      └── index.ts
  ```

- **`src/components/<ComponentName>/`** — one PascalCase folder per
  component, same shape (component + spec + private modules + barrel):

  ```
  src/components/
  ├── AppLayout/     AppLayout.tsx · index.ts
  ├── SessionsTable/ SessionsTable.tsx · SessionsTable.spec.tsx · index.ts
  ├── TrackForm/     TrackForm.tsx · TrackForm.spec.tsx · track-schema.ts · index.ts
  └── ui/            shadcn primitives (see File naming exception)
  ```

- **`src/query/<domain>/`** — the TanStack Query data layer, one folder per
  API domain, split as:
  - `api.ts` — axios calls + payload types
  - `queries.ts` — `useQuery` hooks
  - `mutations.ts` — `useMutation` hooks (omit when the domain has none)
  - `index.ts` — barrel

  Hooks are named `use` + the API function they wrap, so the mapping is
  mechanical: `listSessions` → `useListSessions`, `getTrack` → `useGetTrack`,
  `updateTrack` → `useUpdateTrack`. Don't invent shorter aliases
  (`useTracks`, `useTrack`) — the verb carries information (list vs get vs
  update) and grep-ability matters more than brevity.

- **`src/lib/`** — shared non-React modules (`api-client.ts`,
  `query-client.ts`, `utils.ts`).

Every page, component, and query folder exposes an `index.ts` barrel; import
through it (`@/pages/TrackPage`, `@/components/TrackForm`,
`@/query/tracks`), not deep file paths.

### Handlers after the JSX return

Inside a component, event handlers and other helper functions are hoisted
`function` declarations placed **after** the final `return`, not `const`
arrows above it. The top of the component reads as data flow (hooks, derived
values, early returns, JSX); implementation details live below.

```tsx
export function TrackPage() {
  const updateTrack = useUpdateTrack(slug);

  return <TrackForm onSubmit={onSubmit} />;

  async function onSubmit(values: TrackFormValues) {
    await updateTrack.mutateAsync({ ... });
  }
}
```

### File naming

- Files whose main export is a React component are **PascalCase**:
  `TrackPage.tsx`, `TrackForm.tsx`, `SessionsTable.spec.tsx`.
- Everything else (hooks-less modules, schemas, utilities, barrels) is
  **kebab-case**: `track-schema.ts`, `search-params.ts`, `api-client.ts`.
- Page/component folders are **PascalCase**, named exactly after the
  component they hold: `TrackForm/TrackForm.tsx`. Non-component folders are
  kebab-case: `query/tracks/`, `lib/`.
- Exception: `src/components/ui/*` keeps shadcn's kebab-case file names
  (`button.tsx`, `card.tsx`) so files match upstream shadcn components.

## One repository per entity

Never build a god-repository that spans multiple entities. Each entity gets
its own focused repository class, scoped to that entity's persistence
concerns. This keeps repositories easy to reason about and test in
isolation, and avoids one class accumulating unrelated query methods over
time.
