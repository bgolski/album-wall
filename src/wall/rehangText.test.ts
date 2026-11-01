import { describe, expect, it } from "vitest";
import { stepSentence } from "./rehangText";

const titleOf = (id: string) => `Album ${id}`;
const where = (p: { row: number; column: number }) => `R${p.row} C${p.column}`;
const at = (row: number, column: number) => ({ row, column });

describe("stepSentence", () => {
  it("says each kind of step in words", () => {
    expect(stepSentence({ kind: "take-down", id: "1", from: at(1, 2) }, titleOf, where)).toBe(
      "Take down Album 1 from R1 C2"
    );
    expect(stepSentence({ kind: "set-aside", id: "1", from: at(1, 2) }, titleOf, where)).toBe(
      "Set aside Album 1 from R1 C2"
    );
    expect(
      stepSentence({ kind: "move", id: "1", from: at(1, 2), to: at(3, 4) }, titleOf, where)
    ).toBe("Move Album 1 from R1 C2 to R3 C4");
    expect(stepSentence({ kind: "hang-up", id: "1", to: at(2, 2) }, titleOf, where)).toBe(
      "Hang up Album 1 at R2 C2"
    );
    expect(
      stepSentence({ kind: "replace", id: "2", outId: "1", at: at(2, 3) }, titleOf, where)
    ).toBe("Replace Album 1 with Album 2 at R2 C3");
  });

  it("hangs a cover set aside earlier", () => {
    expect(stepSentence({ kind: "move", id: "1", from: null, to: at(2, 2) }, titleOf, where)).toBe(
      "Hang Album 1, set aside earlier, at R2 C2"
    );
  });
});
