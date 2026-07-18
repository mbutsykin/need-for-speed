# Waiver persistence — design

**Date:** 2026-07-18
**Status:** Approved (design)
**Branch:** `feat/persist-customers`
**App:** `apps/waiver`

## Goal

Persist each completed intake to Postgres. Today, when a party leader finishes
registration, `IntakeScene.finish(ctx, "done")` logs the collected participants
and drops them — the code literally reads `// No DB yet`
([intake.scene.ts:301](../../../apps/waiver/src/chat-bot/scenes/intake/intake.scene.ts)).
This change writes each person to a `customers` table instead. Everything else
about the bot's behavior stays the same; persistence is additive.

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| DB toolkit | **TypeORM** (`@nestjs/typeorm`) | Matches the sibling `nfs` repo (same `<timestamp>-Name.ts` migration convention + CLI); NestJS-native. |
| Local database | **Reuse the running `nfs-postgres-1` container** with a dedicated `waiver` database | Uses docker already running locally; no second Postgres. Only a `CREATE DATABASE waiver` — does not touch the sibling repo's files. |
| Production database | **Neon** | Same `DATABASE_URL` env var; no code difference from local. |
| Record shape | **Flat `customers` table, one row per person** | Simpler than a normalized registrations+participants split; fits the KISS bar. |
| Repeat visits | **Append-only, duplicates allowed** | No dedup/upsert now. If duplicates become a problem, a later migration can collapse them. |
| Marketing consent | **Leader answers once; copied to every participant** | The intake asks consent once on the leader (waiver item 5). The whole group inherits that answer. |

## Data model

One table, `customers`. One row per person. The party/group concept is **not**
persisted; the only surviving cross-person link is a minor pointing at the
leader who vouched for them.

```sql
CREATE TABLE customers (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text        NOT NULL,
  birthday    date        NOT NULL,
  phone       text,
  email       text,
  consent     boolean     NOT NULL,
  social      jsonb       NOT NULL DEFAULT '{}',
  guardian_id uuid        REFERENCES customers (id),
  created_at  timestamptz NOT NULL DEFAULT now()
);
```

Column notes:

- **`phone` / `email`** — both nullable. An adult provides at least one; a minor
  companion may skip both. The "adult needs at least one" rule already lives in
  the intake flow (`nextMissingField`), so no DB check constraint is added — the
  DB accepts what intake produces.
- **`consent`** — the leader's marketing/data-use choice, written to every row in
  the group.
- **`social`** — extensible bag, e.g. `{"telegram": "@handle"}`. Populated only
  for the Telegram account holder (the leader); companions have `{}`.
- **`guardian_id`** — self-referential FK. Set to the leader's `customers.id`
  when the person is a minor companion; `NULL` for the leader and for adult
  companions. This mirrors the current model, where the leader is the only
  possible guardian (the leader gives `guardianAck` for each minor).
- **`created_at`** — the "registered" timestamp; `timestamptz` to keep
  time-of-day.

## Write path

The write happens in `IntakeScene.finish(ctx, "done")`, replacing the
placeholder log. The whole group is written in **one transaction** so a partial
group is never persisted:

1. Insert the **leader** (first participant) with `guardian_id = NULL` and
   `social.telegram` set from their Telegram username; capture the new `id`.
2. For each **companion**, insert with:
   - `guardian_id` = the leader's `id` if the companion is a minor, else `NULL`;
   - `social` = `{}` (companions have no Telegram account of their own).
3. Every row gets `consent` = the leader's consent value.

"Minor" is decided by the existing `isMinor(birthday)` helper
([participant.ts](../../../apps/waiver/src/chat-bot/scenes/intake/participant.ts)),
consistent with how intake already classifies people.

After the transaction commits, the existing summary reply and "done" message are
sent exactly as they are today. If the transaction fails, the error is logged
and the user still receives a completion message — the operator can recover from
logs. (Retry/queueing is out of scope; see below.)

## Layering

A small, focused module keeps the persistence concern out of the scene:

- **`CustomerEntity`** — the TypeORM entity mapping the table above.
- **`CustomersModule`** — imports `TypeOrmModule.forFeature([CustomerEntity])`,
  provides and exports `CustomersService`.
- **`CustomersService.registerGroup(participants: Participant[]): Promise<void>`**
  — owns the transaction and the participants→rows mapping (guardian linking,
  consent propagation, `social` population). The scene calls this one method and
  stays free of DB details.

`CustomersModule` is imported by `ChatBotModule` so the scene can inject
`CustomersService`.

## Configuration

- **Connection** via a single `DATABASE_URL` env var (Postgres URL). Added to
  `apps/waiver/.env.example` and documented in the app README.
- **Wiring** in `app.module.ts` via `TypeOrmModule.forRootAsync`, reading
  `DATABASE_URL` from `ConfigService`. `synchronize` is **off**; schema changes
  go through migrations only.
- **Local value** points at the `waiver` database in `nfs-postgres-1`
  (credentials `nfs:nfs`, e.g.
  `postgres://nfs:nfs@localhost:5432/waiver`). Production points at Neon.

## Migrations

- TypeORM migrations under `apps/waiver/src/db/migrations/`, named
  `<timestamp>-Name.ts`, matching the sibling repo's convention.
- A DataSource config and package scripts (`migration:generate`, `migration:run`,
  `migration:revert`) modeled on the sibling repo.
- The initial migration creates the `customers` table. `gen_random_uuid()` is
  built into Postgres 13+ (local is PG18, Neon is PG14+), so no extension is
  required.
- Local bootstrap: `CREATE DATABASE waiver` in `nfs-postgres-1`, then
  `migration:run`. Documented in the README so it is reproducible.

## Deferred — explicitly out of scope

These are conscious deferrals, not oversights. Each can be added later via
migration without reshaping the above:

- **Terms-version snapshot.** The liability-waiver acceptance ("I accept the
  terms") is checked at the intake gate and not persisted. A real legal record
  would store which terms version each person (or their guardian) accepted. Left
  out of v1 by decision; add a `terms_version` column later if needed.
- **Dedup / upsert of repeat visitors.** Same person registering twice creates
  two rows.
- **Per-person consent.** Consent stays a single leader-level answer copied to
  the group.
- **Delivery guarantees.** No retry queue or outbox; a failed write is logged,
  not re-attempted.

## Testing

- **Unit — mapping.** Test `registerGroup`'s participants→rows mapping with the
  repository/manager mocked: leader gets `guardian_id = NULL` and
  `social.telegram`; a minor companion gets `guardian_id` = leader's id; an adult
  companion gets `guardian_id = NULL`; every row inherits the leader's `consent`.
- **Unit — scene.** The existing intake scene spec stays green;
  `CustomersService` is mocked so scene tests do not touch a database.
- **Manual — end to end.** Run against the local `waiver` database, complete an
  intake with a minor companion, and confirm the rows (including the
  `guardian_id` link) with `psql`.

## Acceptance criteria

- Completing an intake writes one `customers` row per participant in a single
  transaction.
- A minor companion's `guardian_id` references the leader's row; the leader's and
  adult companions' `guardian_id` is `NULL`.
- Every row in a group carries the leader's `consent` value.
- The leader's row has `social.telegram`; companions have `social = {}`.
- Schema is created and evolved through a checked-in TypeORM migration; the app
  runs with `synchronize` off.
- `DATABASE_URL` is documented in `.env.example` and the README; the same code
  path works against local Postgres and Neon.
- Existing tests pass; new mapping tests cover guardian linking and consent
  propagation.
