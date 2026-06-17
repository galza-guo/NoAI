import type { ReplacementEntry } from "./redactor/types";

type CountableReplacement = Pick<ReplacementEntry, "count">;

function pluralize(count: number, singular: string, plural: string): string {
  return count === 1 ? singular : plural;
}

export function formatHitMultiplier(entry: CountableReplacement): string {
  return `x${entry.count}`;
}

export function formatReplacementTotals(entries: CountableReplacement[]): string {
  const ruleCount = entries.length;
  const replacementCount = entries.reduce(
    (total, entry) => total + entry.count,
    0,
  );
  const ruleLabel = pluralize(ruleCount, "rule", "rules");
  const replacementLabel = pluralize(
    replacementCount,
    "replacement",
    "replacements",
  );
  return `${ruleCount} ${ruleLabel}, ${replacementCount} ${replacementLabel}`;
}
