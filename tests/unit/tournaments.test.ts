import { describe, it, expect } from "vitest";
import { calculatePrizePool, validatePayouts } from "../../src/lib/tournaments";

describe("calculatePrizePool", () => {
  it("freezeout: player_count × buy_in only", () => {
    expect(calculatePrizePool(4, 2000, 0, 0, 0, 0)).toBe(8000);
  });

  it("rebuy: adds rebuys and add-ons", () => {
    expect(calculatePrizePool(3, 2000, 2, 2000, 1, 1000)).toBe(
      3 * 2000 + 2 * 2000 + 1 * 1000,
    );
  });

  it("zero players returns 0", () => {
    expect(calculatePrizePool(0, 2000, 0, 0, 0, 0)).toBe(0);
  });

  it("all amounts in cents in, cents out", () => {
    expect(calculatePrizePool(1, 5000, 0, 0, 0, 0)).toBe(5000);
  });
});

describe("validatePayouts", () => {
  it("valid single payout summing to 100", () => {
    expect(validatePayouts([{ position: 1, percentage: 100 }])).toBeNull();
  });

  it("valid multi-payout summing to 100", () => {
    expect(
      validatePayouts([
        { position: 1, percentage: 60 },
        { position: 2, percentage: 30 },
        { position: 3, percentage: 10 },
      ]),
    ).toBeNull();
  });

  it("returns error when sum !== 100", () => {
    expect(validatePayouts([{ position: 1, percentage: 90 }])).toBe(
      "error_percentage_sum",
    );
  });

  it("returns error for duplicate positions", () => {
    expect(
      validatePayouts([
        { position: 1, percentage: 50 },
        { position: 1, percentage: 50 },
      ]),
    ).toBe("error_duplicate_position");
  });

  it("returns error if any percentage <= 0", () => {
    expect(
      validatePayouts([
        { position: 1, percentage: 100 },
        { position: 2, percentage: 0 },
      ]),
    ).toBe("error_percentage_sum");
  });
});
