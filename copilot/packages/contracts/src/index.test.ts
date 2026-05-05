import { describe, expect, it } from "vitest";
import {
  AgentResultSchema,
  AgentTaskSchema,
  parseAgentTask,
} from "./index.js";

describe("contracts", () => {
  it("parses minimal AgentTask", () => {
    const task = parseAgentTask({
      schemaVersion: "1.0.0",
      taskId: "t1",
      engagementId: "e1",
      module: "ig",
      directive: "Enumerate TCP top ports",
      knowledge: {
        engagementFacts: [
          {
            lane: "ig",
            key: "target.host",
            value: "10.10.10.1",
            confidence: "confirmed",
          },
        ],
      },
    });
    expect(task.module).toBe("ig");
  });

  it("rejects AgentResult without status", () => {
    const bad = AgentResultSchema.safeParse({
      schemaVersion: "1.0.0",
      taskId: "t1",
      summary: "ok",
    });
    expect(bad.success).toBe(false);
  });
});
