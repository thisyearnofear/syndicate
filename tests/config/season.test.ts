import { isSeasonTemporallyActive } from "@/config/season";

describe("isSeasonTemporallyActive", () => {
  const now = 1_700_000_000_000;

  it("requires status active", () => {
    expect(
      isSeasonTemporallyActive(
        { status: "closed", drawWindowEnd: now + 10_000 },
        now,
      ),
    ).toBe(false);
  });

  it("hides when the draw window has ended", () => {
    expect(
      isSeasonTemporallyActive(
        { status: "active", drawWindowEnd: now - 1 },
        now,
      ),
    ).toBe(false);
  });

  it("shows active seasons inside the window", () => {
    expect(
      isSeasonTemporallyActive(
        { status: "active", drawWindowEnd: now + 86_400_000 },
        now,
      ),
    ).toBe(true);
  });

  it("allows open-ended windows (drawWindowEnd <= 0)", () => {
    expect(
      isSeasonTemporallyActive({ status: "active", drawWindowEnd: 0 }, now),
    ).toBe(true);
  });
});
