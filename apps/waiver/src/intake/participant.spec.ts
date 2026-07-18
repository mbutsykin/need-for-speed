import { nextMissingField } from "./participant";

describe("nextMissingField", () => {
  it("asks for fields in order: name, contact, birthday", () => {
    expect(nextMissingField({})).toBe("name");
    expect(nextMissingField({ name: "Bob" })).toBe("contact");
    expect(nextMissingField({ name: "Bob", phone: "+1" })).toBe("birthday");
  });

  it("treats email as a valid contact", () => {
    expect(nextMissingField({ name: "Bob", email: "b@x.com" })).toBe("birthday");
  });

  it("returns null when the participant is complete", () => {
    expect(nextMissingField({ name: "Bob", phone: "+1", birthday: "1990-01-01" })).toBeNull();
  });
});
