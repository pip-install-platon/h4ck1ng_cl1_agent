import type { GraphOp } from "@pentest-copilot/contracts";
import { describe, expect, it } from "vitest";
import { EngagementGraphStore } from "./graph-store.js";

describe("EngagementGraphStore", () => {
  it("applies addNode and mergeNode", () => {
    const g = new EngagementGraphStore("e-test", "/tmp/x");
    const ops: GraphOp[] = [
      {
        op: "addNode",
        node: {
          id: "n1",
          type: "host",
          lane: "ig",
          label: "10.0.0.1",
          data: { a: 1 },
        },
      },
      {
        op: "mergeNode",
        id: "n1",
        patch: { b: 2 },
      },
    ];
    g.applyGraphOps(ops);
    expect(g.getState().nodes["n1"]?.data).toEqual({ a: 1, b: 2 });
  });
});
