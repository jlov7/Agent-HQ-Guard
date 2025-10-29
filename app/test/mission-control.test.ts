import { afterEach, describe, expect, it, vi } from "vitest";
import { createMissionControlClient, MissionControlError } from "../src/mission-control";

const originalEnv = { ...process.env };

afterEach(() => {
  process.env = { ...originalEnv };
});

describe("mission control client", () => {
  it("returns undefined when feature flag absent", () => {
    delete process.env.AGENT_HQ_API_URL;
    expect(createMissionControlClient()).toBeUndefined();
  });

  it("publishes decisions with retries", async () => {
    process.env.AGENT_HQ_API_URL = "https://mission-control.test";
    const fetchImpl = vi
      .fn<
        Parameters<typeof fetch>,
        Promise<{ ok: boolean; status: number; text: () => Promise<string> }>
      >()
      .mockRejectedValueOnce(new Error("network"))
      .mockResolvedValueOnce({ ok: false, status: 500, text: async () => "fail" })
      .mockResolvedValue({ ok: true, status: 200, text: async () => "ok" });

    const logger = vi.fn();
    const client = createMissionControlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      logger,
      delayFn: async () => undefined
    });
    expect(client).toBeDefined();
    await client?.publishDecision({
      runId: "run",
      allow: true,
      reasons: [],
      budgetTokens: 100
    });

    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(logger).toHaveBeenCalled();
  });

  it("throws MissionControlError on persistent failure", async () => {
    process.env.AGENT_HQ_API_URL = "https://mission-control.test";
    const fetchImpl = vi
      .fn<
        Parameters<typeof fetch>,
        Promise<{ ok: boolean; status: number; text: () => Promise<string> }>
      >()
      .mockResolvedValue({
        ok: false,
        status: 403,
        text: async () => "denied"
      });

    const client = createMissionControlClient({
      fetchImpl: fetchImpl as unknown as typeof fetch,
      delayFn: async () => undefined
    });

    await expect(
      client?.publishDecision({
        runId: "run",
        allow: false,
        reasons: ["denied"],
        budgetTokens: 0
      })
    ).rejects.toBeInstanceOf(MissionControlError);
  });
});
