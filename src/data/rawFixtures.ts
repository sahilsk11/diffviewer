import fridayMetadata from "../../fixtures/github/sahilsk11/friday/pr-37/metadata.json";
import fridayRawDiff from "../../fixtures/github/sahilsk11/friday/pr-37/raw.diff?raw";
import overwatchMetadata from "../../fixtures/github/sahilsk11/overwatch/pr-9/metadata.json";
import overwatchRawDiff from "../../fixtures/github/sahilsk11/overwatch/pr-9/raw.diff?raw";
import type { GitHubPrFixture, RawPrFixture } from "./types";

export const rawPrFixtures = [
  {
    id: "friday#37",
    metadata: fridayMetadata as GitHubPrFixture,
    rawDiff: fridayRawDiff,
  },
  {
    id: "overwatch#9",
    metadata: overwatchMetadata as GitHubPrFixture,
    rawDiff: overwatchRawDiff,
  },
] as const satisfies RawPrFixture[];
