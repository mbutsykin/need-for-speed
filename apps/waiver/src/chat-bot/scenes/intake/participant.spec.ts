import { age, isMinor, nextMissingField } from "./participant";

const NOW = new Date("2026-07-18T00:00:00Z");

describe("age / isMinor", () => {
  it("computes whole years, accounting for a birthday not yet reached this year", () => {
    expect(age("1990-01-01", NOW)).toBe(36);
    expect(age("2010-12-31", NOW)).toBe(15);
  });

  it("flags under-18 as minors", () => {
    expect(isMinor("2010-01-01", NOW)).toBe(true); // 16
    expect(isMinor("2007-01-01", NOW)).toBe(false); // 19
  });
});

describe("nextMissingField", () => {
  it("asks name, then birthday before contact", () => {
    expect(nextMissingField({}, true, NOW)).toBe("name");
    expect(nextMissingField({ name: "Bob" }, true, NOW)).toBe("birthday");
    expect(nextMissingField({ name: "Bob", phone: "+1" }, true, NOW)).toBe("birthday");
    expect(nextMissingField({ name: "Bob", birthday: "1990-01-01" }, true, NOW)).toBe("contact");
  });

  it("completes an adult with name, birthday and contact", () => {
    expect(
      nextMissingField({ name: "Bob", birthday: "1990-01-01", phone: "+1" }, true, NOW),
    ).toBeNull();
  });

  it("requires guardian ack for a minor companion before contact", () => {
    const minor = { name: "Kid", birthday: "2015-01-01" };

    expect(nextMissingField(minor, false, NOW)).toBe("guardian");
    expect(nextMissingField({ ...minor, guardianAck: true }, false, NOW)).toBe("contact");
  });

  it("lets a minor companion skip contact, but not an adult", () => {
    const minor = { name: "Kid", birthday: "2015-01-01", guardianAck: true, contactSkipped: true };
    const adult = { name: "Bob", birthday: "1990-01-01", contactSkipped: true };

    expect(nextMissingField(minor, false, NOW)).toBeNull();
    expect(nextMissingField(adult, false, NOW)).toBe("contact");
  });
});
