import type { DiffHunk, GitHubChangedFile, ParsedChangedFile } from "./types";

const DIFF_FILE_HEADER = /^diff --git a\/(.+) b\/(.+)$/;
const HUNK_HEADER =
  /^@@ -(?<oldStart>\d+)(?:,(?<oldLines>\d+))? \+(?<newStart>\d+)(?:,(?<newLines>\d+))? @@(?: (?<context>.*))?$/;

export function parseDiffHunks(rawDiff: string): DiffHunk[] {
  const hunks: DiffHunk[] = [];
  let currentFilePath: string | null = null;

  for (const line of rawDiff.split("\n")) {
    const fileMatch = DIFF_FILE_HEADER.exec(line);
    if (fileMatch) {
      currentFilePath = fileMatch[2];
      continue;
    }

    const hunkMatch = HUNK_HEADER.exec(line);
    if (!hunkMatch?.groups || currentFilePath === null) {
      continue;
    }

    hunks.push({
      filePath: currentFilePath,
      header: line,
      oldStart: Number(hunkMatch.groups.oldStart),
      oldLines: Number(hunkMatch.groups.oldLines ?? "1"),
      newStart: Number(hunkMatch.groups.newStart),
      newLines: Number(hunkMatch.groups.newLines ?? "1"),
      context: hunkMatch.groups.context,
    });
  }

  return hunks;
}

export function attachDiffHunks(
  files: readonly GitHubChangedFile[],
  rawDiff: string,
): ParsedChangedFile[] {
  const hunks = parseDiffHunks(rawDiff);

  return files.map((file) => ({
    ...file,
    diffHunks: hunks.filter((hunk) => hunk.filePath === file.path),
  }));
}
