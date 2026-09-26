import { ACCENTS, MOTION_BUDGET, OKLCH, RECEIPT } from "@/config/design";

describe("OKLCH design tokens", () => {
  it("keeps ladder accents on OKLCH gradients", () => {
    expect(ACCENTS.play.gradientText).toContain("oklch(");
    expect(ACCENTS.grow.gradientText).toContain("oklch(");
    expect(ACCENTS.coordinate.gradientText).toContain("oklch(");
    expect(ACCENTS.experimental.gradientText).toContain("oklch(");
    expect(ACCENTS.arena.gradientText).toContain("oklch(");
  });

  it("exports matched swatches for each ladder accent", () => {
    expect(OKLCH.play.mid).toMatch(/^oklch\(/);
    expect(OKLCH.grow.mid).toMatch(/^oklch\(/);
    expect(OKLCH.coordinate.mid).toMatch(/^oklch\(/);
    expect(OKLCH.receipt.verified).toMatch(/^oklch\(/);
  });

  it("caps BeamFrame on consumer surfaces", () => {
    expect(MOTION_BUDGET.beamLapsMax).toBeLessThanOrEqual(2);
    expect(MOTION_BUDGET.beamLapsMax).toBeGreaterThan(0);
    expect(Number.isFinite(MOTION_BUDGET.beamLapsMax)).toBe(true);
  });

  it("keeps receipt tokens distinct by status", () => {
    expect(RECEIPT.dotVerified).not.toEqual(RECEIPT.dotPending);
    expect(RECEIPT.verified).toContain("oklch");
  });
});
