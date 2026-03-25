import { describe, it, expect } from "vitest";
import { calculatePrizePool, validatePayouts, calculatePayouts } from "../../src/lib/tournaments";

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

describe("calculatePayouts", () => {
  it("distributes prize pool with clean percentages (no remainder)", () => {
    const players = [
      { id: "p1", finish_position: 1 },
      { id: "p2", finish_position: 2 },
      { id: "p3", finish_position: 3 },
    ];
    const payouts = [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 10 },
    ];
    const result = calculatePayouts(players, payouts, 10000);
    expect(result).toEqual(
      expect.arrayContaining([
        { playerId: "p1", amount: 6000 },
        { playerId: "p2", amount: 3000 },
        { playerId: "p3", amount: 1000 },
      ])
    );
  });

  it("adds rounding remainder to 1st place player", () => {
    // pool=10001, 60/30/10%: floor(6000.6)=6000, floor(3000.3)=3000, floor(1000.1)=1000
    // distributed=10000, remainder=1 → goes to position 1
    const players = [
      { id: "p1", finish_position: 1 },
      { id: "p2", finish_position: 2 },
      { id: "p3", finish_position: 3 },
    ];
    const payouts = [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 10 },
    ];
    const result = calculatePayouts(players, payouts, 10001);
    const p1 = result.find((r) => r.playerId === "p1")!;
    const p2 = result.find((r) => r.playerId === "p2")!;
    const p3 = result.find((r) => r.playerId === "p3")!;
    expect(p1.amount).toBe(6001); // gets the +1 remainder
    expect(p2.amount).toBe(3000);
    expect(p3.amount).toBe(1000);
  });

  it("skips prize positions with no matching player — percentage not redistributed", () => {
    const players = [
      { id: "p1", finish_position: 1 },
      { id: "p2", finish_position: 2 },
    ];
    const payouts = [
      { position: 1, percentage: 60 },
      { position: 2, percentage: 30 },
      { position: 3, percentage: 10 }, // no player in 3rd — not redistributed
    ];
    const result = calculatePayouts(players, payouts, 10000);
    expect(result).toHaveLength(2);
    const p1 = result.find((r) => r.playerId === "p1")!;
    const p2 = result.find((r) => r.playerId === "p2")!;
    expect(p1.amount).toBe(6000); // no redistribution of 3rd's 10%
    expect(p2.amount).toBe(3000);
  });

  it("unpaid players receive amount 0", () => {
    const players = [
      { id: "p1", finish_position: 1 },
      { id: "p2", finish_position: 2 },
      { id: "p3", finish_position: 3 },
      { id: "p4", finish_position: 4 },
    ];
    const payouts = [
      { position: 1, percentage: 70 },
      { position: 2, percentage: 30 },
    ];
    const result = calculatePayouts(players, payouts, 10000);
    const p3 = result.find((r) => r.playerId === "p3")!;
    const p4 = result.find((r) => r.playerId === "p4")!;
    expect(p3.amount).toBe(0);
    expect(p4.amount).toBe(0);
    expect(result).toHaveLength(4); // all players have an entry
  });
});
