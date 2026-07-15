import { expectTypeOf } from "expect-type";

import { definePatternRecognizer } from "../src/detect/pattern-recognizer";
import type { Recognizer } from "../src/types";

const employeeId = definePatternRecognizer({
  id: "employee-id",
  entity: "employee_id",
  tier: 0,
  patterns: [{ source: String.raw`\bEMP-\d{5}\b` }],
});

expectTypeOf(employeeId).toExtend<Recognizer>();
expectTypeOf(employeeId.scan).returns.toExtend<Array<{ entity: string }>>();
