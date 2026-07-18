import { isMinor } from "../chat-bot/scenes/intake/participant";
import type { Participant } from "../chat-bot/scenes/intake/types";

/** A single `customers` row ready to insert, minus the DB-assigned id/guardian_id. */
export interface CustomerRow {
  name: string;
  birthday: string;
  phone: string | null;
  email: string | null;
  consent: boolean;
  social: { telegram?: string };
  /** A minor companion: its guardian_id must be set to the leader's id at insert time. */
  linkToLeader: boolean;
}

/** Persists one row and returns its DB-assigned id. */
export type CustomerInserter = (row: CustomerRow, guardianId: string | null) => Promise<string>;

/**
 * Turns the collected party into `customers` rows. The first participant is the
 * leader: only they carry a Telegram handle, and their marketing consent is
 * copied onto everyone. A minor companion is flagged `linkToLeader` so the
 * insert step can point its guardian_id at the leader's row.
 */
export function toCustomerRows(participants: Participant[], now?: Date): CustomerRow[] {
  const leaderConsent = participants[0]?.consent ?? false;

  return participants.map((participant, index) => {
    const isLeader = index === 0;
    const minor =
      !isLeader && participant.birthday !== undefined && isMinor(participant.birthday, now);

    return {
      name: participant.name ?? "",
      birthday: participant.birthday ?? "",
      phone: participant.phone ?? null,
      email: participant.email ?? null,
      consent: leaderConsent,
      social: isLeader && participant.username ? { telegram: participant.username } : {},
      linkToLeader: minor,
    };
  });
}

/**
 * Inserts a party in leader-first order: the leader gets no guardian, then each
 * minor companion is linked to the leader's freshly assigned id. `insert` owns
 * the actual write (and, in production, the surrounding transaction).
 */
export async function insertGroup(rows: CustomerRow[], insert: CustomerInserter): Promise<void> {
  if (rows.length === 0) return;

  const [leader, ...rest] = rows;
  const leaderId = await insert(leader, null);

  for (const row of rest) {
    await insert(row, row.linkToLeader ? leaderId : null);
  }
}
