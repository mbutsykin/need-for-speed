import type { MissingField, Participant } from "./intake.types";

/** Below this age a participant is a minor: the leader must vouch for them. */
export const MINOR_AGE = 18;

/** Whole years old on `now`, given an ISO (YYYY-MM-DD) birthday. */
export function age(isoBirthday: string, now: Date = new Date()): number {
  const [year, month, day] = isoBirthday.split("-").map(Number);
  let years = now.getUTCFullYear() - year;
  const month1 = now.getUTCMonth() + 1;

  if (month1 < month || (month1 === month && now.getUTCDate() < day)) years -= 1;

  return years;
}

export function isMinor(isoBirthday: string, now: Date = new Date()): boolean {
  return age(isoBirthday, now) < MINOR_AGE;
}

/**
 * The next required field/step for a participant, or null when complete.
 * Birthday comes before contact (age drives the rest): a minor companion needs
 * the leader's guardian acknowledgment and may then skip contact; an adult must
 * provide a phone or email. Consent is asked once at the end, not here.
 */
export function nextMissingField(
  participant: Participant,
  isLeader: boolean,
  now: Date = new Date(),
): MissingField | null {
  if (!participant.name) return "name";

  if (!participant.birthday) return "birthday";

  const minor = !isLeader && isMinor(participant.birthday, now);

  if (minor && !participant.guardianAck) return "guardian";

  const hasContact = Boolean(participant.phone || participant.email);

  if (!hasContact && !(minor && participant.contactSkipped)) return "contact";

  return null;
}
