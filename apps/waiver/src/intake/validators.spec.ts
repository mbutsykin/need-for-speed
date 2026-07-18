import { parseBirthday, parseParticipantFields, parsePhone } from "./validators";

const NOW = new Date("2026-07-18T00:00:00Z");

describe("parsePhone", () => {
  it("accepts + and spaced/dashed numbers", () => {
    expect(parsePhone("+380989126059")).toBe("+380989126059");
    expect(parsePhone("+380 98 912-60-59")).toBe("+380989126059");
  });

  it("rejects non-phones (incl. dotted dates)", () => {
    expect(parsePhone("hello")).toBeNull();
    expect(parsePhone("20.05.1994")).toBeNull();
  });
});

describe("parseBirthday", () => {
  it("accepts DD.MM.YYYY and ISO, returning canonical ISO", () => {
    expect(parseBirthday("20.05.1994", NOW)).toBe("1994-05-20");
    expect(parseBirthday("1.1.1990", NOW)).toBe("1990-01-01");
    expect(parseBirthday("1994-05-20", NOW)).toBe("1994-05-20");
  });

  it("rejects impossible, future, and unrealistic dates", () => {
    expect(parseBirthday("32.13.2020", NOW)).toBeNull();
    expect(parseBirthday("01.01.2030", NOW)).toBeNull();
    expect(parseBirthday("01.01.1850", NOW)).toBeNull();
    expect(parseBirthday("hello", NOW)).toBeNull();
  });
});

describe("parseParticipantFields", () => {
  const expected = {
    name: "Maksym Butsykin",
    email: "mbutsykin@gmail.com",
    phone: "+380989126059",
    birthday: "1994-05-20",
  };

  it("parses a newline-separated block", () => {
    const input = "Maksym Butsykin\nmbutsykin@gmail.com\n+380989126059\n20.05.1994";

    expect(parseParticipantFields(input, NOW)).toEqual(expected);
  });

  it("parses a comma-separated line", () => {
    const input = "Maksym Butsykin, mbutsykin@gmail.com, +380989126059, 20.05.1994";

    expect(parseParticipantFields(input, NOW)).toEqual(expected);
  });

  it("classifies a single field on its own", () => {
    expect(parseParticipantFields("20.05.1994", NOW)).toEqual({ birthday: "1994-05-20" });
    expect(parseParticipantFields("mbutsykin@gmail.com", NOW)).toEqual({
      email: "mbutsykin@gmail.com",
    });
  });

  it("joins leftover tokens into the name", () => {
    expect(parseParticipantFields("Maksym, Butsykin", NOW)).toEqual({ name: "Maksym Butsykin" });
  });
});
