/** One person being registered. The Telegram user is just the first participant. */
export interface Participant {
  name?: string;
  /** Telegram @username — only the account holder (first participant) has one. */
  username?: string;
  phone?: string;
  email?: string;
  /** Canonical ISO date, YYYY-MM-DD. */
  birthday?: string;
  /** Leader's acknowledgment of responsibility for a minor companion (age < 18). */
  guardianAck?: boolean;
  /** A minor may skip contact (they often have none of their own). */
  contactSkipped?: boolean;
  /** Marketing/data-use consent (waiver item 5). Asked once at the end, on the leader. */
  consent?: boolean;
}

export type IntakeStage = "terms" | "collecting" | "menu" | "consent";

/** Scene state, persisted in the Telegraf scene session across messages. */
export interface IntakeState {
  participants: Participant[];
  draft: Participant;
  stage: IntakeStage;
}

/** A required field/step still outstanding for a participant. */
export type MissingField = "name" | "birthday" | "guardian" | "contact";
