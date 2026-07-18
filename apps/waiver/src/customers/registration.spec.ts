import type { Participant } from "../chat-bot/scenes/intake/types";

import { insertGroup, toCustomerRows, type CustomerRow } from "./registration";

// A fixed "now" so isMinor() is deterministic regardless of the real date.
const NOW = new Date("2026-07-18T00:00:00Z");

const LEADER: Participant = {
  name: "Lead Er",
  username: "leader_tg",
  phone: "+380111111111",
  email: "leader@example.com",
  birthday: "1990-01-01",
  consent: true,
};

const ADULT: Participant = { name: "Adult Two", phone: "+380222222222", birthday: "1988-03-03" };

const MINOR: Participant = {
  name: "Kid",
  birthday: "2015-05-20",
  guardianAck: true,
  contactSkipped: true,
};

describe("toCustomerRows", () => {
  it("maps the leader with their telegram handle and no guardian link", () => {
    const [leader] = toCustomerRows([LEADER], NOW);

    expect(leader).toEqual({
      name: "Lead Er",
      birthday: "1990-01-01",
      phone: "+380111111111",
      email: "leader@example.com",
      consent: true,
      social: { telegram: "leader_tg" },
      linkToLeader: false,
    });
  });

  it("copies the leader's consent onto every participant", () => {
    const rows = toCustomerRows([{ ...LEADER, consent: true }, ADULT, MINOR], NOW);

    expect(rows.map((r) => r.consent)).toEqual([true, true, true]);
  });

  it("links a minor companion to the leader but leaves an adult companion unlinked", () => {
    const rows = toCustomerRows([LEADER, ADULT, MINOR], NOW);

    expect(rows.map((r) => r.linkToLeader)).toEqual([false, false, true]);
  });

  it("gives companions an empty social object and no phone/email defaults to null", () => {
    const [, , minor] = toCustomerRows([LEADER, ADULT, MINOR], NOW);

    expect(minor.social).toEqual({});
    expect(minor.phone).toBeNull();
    expect(minor.email).toBeNull();
  });

  it("omits telegram when the leader has no username", () => {
    const [leader] = toCustomerRows([{ ...LEADER, username: undefined }], NOW);

    expect(leader.social).toEqual({});
  });
});

describe("insertGroup", () => {
  function fakeInserter() {
    const calls: Array<{ row: CustomerRow; guardianId: string | null }> = [];
    const insert = async (row: CustomerRow, guardianId: string | null): Promise<string> => {
      calls.push({ row, guardianId });

      return `id-${calls.length - 1}`;
    };

    return { calls, insert };
  }

  const leaderRow: CustomerRow = {
    name: "Lead Er",
    birthday: "1990-01-01",
    phone: "+380111111111",
    email: null,
    consent: true,
    social: { telegram: "leader_tg" },
    linkToLeader: false,
  };
  const adultRow: CustomerRow = { ...leaderRow, name: "Adult", social: {}, linkToLeader: false };
  const minorRow: CustomerRow = { ...leaderRow, name: "Kid", social: {}, linkToLeader: true };

  it("inserts the leader first with no guardian, then links minors to the leader's id", async () => {
    const { calls, insert } = fakeInserter();

    await insertGroup([leaderRow, adultRow, minorRow], insert);

    expect(calls.map((c) => c.row.name)).toEqual(["Lead Er", "Adult", "Kid"]);
    expect(calls[0].guardianId).toBeNull(); // leader
    expect(calls[1].guardianId).toBeNull(); // adult companion
    expect(calls[2].guardianId).toBe("id-0"); // minor -> leader's id
  });

  it("does nothing for an empty group", async () => {
    const { calls, insert } = fakeInserter();

    await insertGroup([], insert);

    expect(calls).toHaveLength(0);
  });
});
