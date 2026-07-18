import { z } from "zod";

import type { Participant } from "./types";

const MAX_AGE_YEARS = 120;
const emailSchema = z.string().email().max(254);

/** Normalizes and validates an email, or returns null. */
export function parseEmail(input: string): string | null {
  const result = emailSchema.safeParse(input.trim().toLowerCase());

  return result.success ? result.data : null;
}

/** Accepts +digits / spaced / dashed phone numbers (7-15 digits), or returns null. */
export function parsePhone(input: string): string | null {
  const cleaned = input.replace(/[\s()-]/g, "");

  return /^\+?\d{7,15}$/.test(cleaned) ? cleaned : null;
}

/** Parses `DD.MM.YYYY` or ISO `YYYY-MM-DD` into a canonical ISO date, or returns null. */
export function parseBirthday(input: string, now: Date = new Date()): string | null {
  const parts = splitDate(input.trim());

  if (!parts) return null;

  const [year, month, day] = parts;
  const date = new Date(Date.UTC(year, month - 1, day));

  const isRealDate =
    date.getUTCFullYear() === year && date.getUTCMonth() === month - 1 && date.getUTCDate() === day;
  const inFuture = date.getTime() > now.getTime();
  const tooOld = year < now.getUTCFullYear() - MAX_AGE_YEARS;

  if (!isRealDate || inFuture || tooOld) return null;

  return `${pad(year, 4)}-${pad(month, 2)}-${pad(day, 2)}`;
}

/**
 * Splits a free-form message (newline- or comma-separated) into participant
 * fields by classifying each token: email → birthday → phone, and whatever is
 * left over becomes the name.
 */
export function parseParticipantFields(
  input: string,
  now: Date = new Date(),
): Partial<Participant> {
  const draft: Partial<Participant> = {};
  const nameParts: string[] = [];

  for (const token of input
    .split(/[\n,]+/)
    .map((t) => t.trim())
    .filter(Boolean)) {
    const email = parseEmail(token);

    if (email) {
      draft.email = email;
      continue;
    }

    const birthday = parseBirthday(token, now);

    if (birthday) {
      draft.birthday = birthday;
      continue;
    }

    const phone = parsePhone(token);

    if (phone) {
      draft.phone = phone;
      continue;
    }

    nameParts.push(token);
  }

  if (nameParts.length > 0) draft.name = nameParts.join(" ");

  return draft;
}

function splitDate(value: string): [number, number, number] | null {
  const dotted = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(value);

  if (dotted) return [Number(dotted[3]), Number(dotted[2]), Number(dotted[1])];

  const iso = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(value);

  if (iso) return [Number(iso[1]), Number(iso[2]), Number(iso[3])];

  return null;
}

function pad(n: number, width: number): string {
  return String(n).padStart(width, "0");
}
