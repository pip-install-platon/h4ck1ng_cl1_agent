import { z } from "zod";

export const LaneSchema = z.enum([
  "ig",
  "vuln",
  "exploit",
  "post",
  "prep",
  "obj",
  "report",
]);

export type Lane = z.infer<typeof LaneSchema>;

export const AgentModuleSchema = z.enum([
  "ig",
  "prep",
  "vuln",
  "exploit",
  "post",
  "obj",
  "report",
]);

export type AgentModule = z.infer<typeof AgentModuleSchema>;

export const EngagementFactSchema = z.object({
  id: z.string().optional(),
  lane: LaneSchema,
  key: z.string(),
  value: z.string(),
  confidence: z.enum(["confirmed", "hypothesis"]).default("hypothesis"),
});

export type EngagementFact = z.infer<typeof EngagementFactSchema>;

export const CrossEngagementHintsSchema = z.object({
  priorReportIds: z.array(z.string()).default([]),
  summaryBullets: z.array(z.string()).max(64).optional(),
});

export type CrossEngagementHints = z.infer<
  typeof CrossEngagementHintsSchema
>;

export const KnowledgeBundleSchema = z.object({
  engagementFacts: z.array(EngagementFactSchema).default([]),
  crossEngagementHints: CrossEngagementHintsSchema.optional(),
});

export type KnowledgeBundle = z.infer<typeof KnowledgeBundleSchema>;

export const SkillPackSchema = z.object({
  schemaVersion: z.string(),
  toolIds: z.array(z.string()),
  skillRefs: z.array(z.string()),
  resolvedContent: z.string().max(512_000).optional(),
  contentHash: z.string().optional(),
});

export type SkillPack = z.infer<typeof SkillPackSchema>;

export const ArtifactRefSchema = z.object({
  id: z.string(),
  path: z.string().optional(),
  mimeType: z.string().optional(),
});

export const AgentConstraintsSchema = z.object({
  maxPromptChars: z.number().int().positive().optional(),
  maxOutputFindings: z.number().int().positive().optional(),
  allowedSudoCommands: z.array(z.string()).optional(),
  osHint: z.string().optional(),
  platformScope: z.string().optional(),
  htbVpnRequired: z.boolean().optional(),
});

export type AgentConstraints = z.infer<typeof AgentConstraintsSchema>;

export const AgentTaskSchema = z.object({
  schemaVersion: z.string(),
  taskId: z.string(),
  engagementId: z.string(),
  targetRef: z.string().optional(),
  module: AgentModuleSchema,
  directive: z.string(),
  knowledge: KnowledgeBundleSchema.default({ engagementFacts: [] }),
  constraints: AgentConstraintsSchema.optional(),
  artifacts: z.array(ArtifactRefSchema).optional(),
  skillPack: SkillPackSchema.optional(),
  dedupeKey: z.string().optional(),
});

export type AgentTask = z.infer<typeof AgentTaskSchema>;

export const TerminalSessionRecordSchema = z.object({
  sessionId: z.string(),
  command: z.string(),
  cwd: z.string().optional(),
  exitCode: z.number().int().nullable(),
  stdout: z.string(),
  stderr: z.string(),
  truncated: z.boolean(),
  startedAt: z.string(),
  endedAt: z.string(),
});

export type TerminalSessionRecord = z.infer<typeof TerminalSessionRecordSchema>;

export const EvidenceRefSchema = z.object({
  sessionId: z.string().optional(),
  excerpt: z.string().max(8000).optional(),
  artifactId: z.string().optional(),
  lineRange: z.tuple([z.number().int(), z.number().int()]).optional(),
});

export type EvidenceRef = z.infer<typeof EvidenceRefSchema>;

export const OutputFindingSchema = z.object({
  claim: z.string().max(8000),
  evidenceRef: EvidenceRefSchema,
  confidence: z.enum(["high", "medium", "low"]),
  inconclusive: z.boolean().optional(),
});

export type OutputFinding = z.infer<typeof OutputFindingSchema>;

export const GraphNodeSchema = z.object({
  id: z.string(),
  type: z.string(),
  lane: LaneSchema.optional(),
  label: z.string().optional(),
  data: z.record(z.string(), z.unknown()).default({}),
});

export type GraphNode = z.infer<typeof GraphNodeSchema>;

export const GraphEdgeSchema = z.object({
  id: z.string(),
  fromId: z.string(),
  toId: z.string(),
  label: z.string().optional(),
  data: z.record(z.string(), z.unknown()).optional(),
});

export type GraphEdge = z.infer<typeof GraphEdgeSchema>;

export const GraphOpSchema = z.discriminatedUnion("op", [
  z.object({
    op: z.literal("addNode"),
    node: GraphNodeSchema,
  }),
  z.object({
    op: z.literal("addEdge"),
    edge: GraphEdgeSchema,
  }),
  z.object({
    op: z.literal("mergeNode"),
    id: z.string(),
    patch: z.record(z.string(), z.unknown()),
  }),
]);

export type GraphOp = z.infer<typeof GraphOpSchema>;

export const SkillPackEchoSchema = z.object({
  toolIds: z.array(z.string()),
});

export const AgentResultSchema = z.object({
  schemaVersion: z.string(),
  taskId: z.string(),
  status: z.enum(["completed", "failed", "blocked"]),
  terminalSessions: z.array(TerminalSessionRecordSchema).optional(),
  outputFindings: z.array(OutputFindingSchema).optional(),
  summary: z.string().max(4000),
  graphOps: z.array(GraphOpSchema).optional(),
  artifacts: z.array(z.record(z.string(), z.unknown())).optional(),
  poc: z.string().optional(),
  code: z.string().optional(),
  blockedReason: z.string().optional(),
  blockedRequires: z.array(z.string()).optional(),
  skillPackEcho: SkillPackEchoSchema.optional(),
  error: z.string().optional(),
});

export type AgentResult = z.infer<typeof AgentResultSchema>;

export function parseAgentTask(input: unknown): AgentTask {
  return AgentTaskSchema.parse(input);
}

export function parseAgentResult(input: unknown): AgentResult {
  return AgentResultSchema.parse(input);
}

export function safeParseAgentTask(
  input: unknown,
): z.SafeParseReturnType<unknown, AgentTask> {
  return AgentTaskSchema.safeParse(input);
}

export function safeParseAgentResult(
  input: unknown,
): z.SafeParseReturnType<unknown, AgentResult> {
  return AgentResultSchema.safeParse(input);
}
