import type { FindingView } from "@/components/audit/AuditReport";
import type { RankedFinding } from "./index";

export const toFindingView = (f: RankedFinding): FindingView => ({
  checkKey: f.checkKey,
  severity: f.severity,
  title: f.title,
  explanation: f.explanation,
  fix: f.fix,
  estMonthlyWasteMicros: f.estMonthlyWasteMicros,
  evidence: f.evidence,
  recommendedActions: f.recommendedActions,
});
