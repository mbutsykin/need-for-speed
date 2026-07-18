import type { MissingField, Participant } from "./intake.types";

/**
 * The next required field still missing from a participant, or null when
 * complete. Contact is satisfied by either a phone or an email.
 */
export function nextMissingField(participant: Participant): MissingField | null {
  if (!participant.name) return "name";

  if (!participant.phone && !participant.email) return "contact";

  if (!participant.birthday) return "birthday";

  return null;
}
