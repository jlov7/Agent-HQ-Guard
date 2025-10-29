interface MissionControlDecisionPayload {
  runId: string;
  allow: boolean;
  reasons: string[];
  budgetTokens: number;
}

export interface MissionControlClient {
  publishDecision(payload: MissionControlDecisionPayload): Promise<void>;
}

export class MissionControlError extends Error {
  constructor(
    message: string,
    readonly status?: number,
    readonly responseBody?: string
  ) {
    super(message);
    this.name = "MissionControlError";
  }
}

interface MissionControlOptions {
  fetchImpl?: typeof fetch;
  logger?: (level: "warn" | "error", message: string, details?: unknown) => void;
  delayFn?: (ms: number) => Promise<void>;
}

const MAX_ATTEMPTS = 3;
const BASE_DELAY_MS = 200;

export function createMissionControlClient(
  options: MissionControlOptions = {}
): MissionControlClient | undefined {
  const url = process.env.AGENT_HQ_API_URL;
  if (!url) {
    return undefined;
  }

  const fetchImpl = options.fetchImpl ?? globalThis.fetch;
  if (!fetchImpl) {
    throw new MissionControlError("Global fetch implementation is required for mission control.");
  }

  const delayFn = options.delayFn ?? delay;

  return {
    async publishDecision(payload: MissionControlDecisionPayload) {
      for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
        try {
          const response = await fetchImpl(`${url}/decisions`, {
            method: "POST",
            headers: {
              "content-type": "application/json"
            },
            body: JSON.stringify(payload)
          });

          if (response.ok) {
            return;
          }

          const body = await safeReadBody(response);
          options.logger?.(
            "warn",
            `Mission control responded with status ${response.status}`,
            body
          );

          if (attempt === MAX_ATTEMPTS) {
            throw new MissionControlError(
              `Mission control rejected decision with status ${response.status}`,
              response.status,
              body ?? undefined
            );
          }
        } catch (error) {
          if (attempt === MAX_ATTEMPTS) {
            if (error instanceof MissionControlError) {
              throw error;
            }

            throw new MissionControlError(
              "Failed to publish decision to mission control",
              undefined,
              error instanceof Error ? error.message : String(error)
            );
          }

          options.logger?.("warn", "Retrying mission control publish after transient error", error);
        }

        await delayFn(BASE_DELAY_MS * 2 ** (attempt - 1));
      }
    }
  };
}

async function safeReadBody(response: Response): Promise<string | undefined> {
  try {
    return await response.text();
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}
