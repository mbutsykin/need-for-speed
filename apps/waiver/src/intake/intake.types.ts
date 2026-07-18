/** One person being registered. The Telegram user is just the first participant. */
export interface Participant {
  name?: string;
  phone?: string;
  email?: string;
  /** Canonical ISO date, YYYY-MM-DD. */
  birthday?: string;
}

export type IntakeStage = "collecting" | "menu";

/** Scene state, persisted in the Telegraf scene session across messages. */
export interface IntakeState {
  participants: Participant[];
  draft: Participant;
  stage: IntakeStage;
}

/** A required field still absent from a participant. */
export type MissingField = "name" | "contact" | "birthday";
