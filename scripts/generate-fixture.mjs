#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const DEFAULT_OWNER = "sahilsk11";
const FIXTURE_ROOT = join(
  dirname(fileURLToPath(import.meta.url)),
  "..",
  "fixtures",
  "github",
);

const PR_FIELDS = [
  "additions",
  "assignees",
  "author",
  "baseRefName",
  "baseRefOid",
  "body",
  "changedFiles",
  "closed",
  "comments",
  "commits",
  "createdAt",
  "deletions",
  "files",
  "headRefName",
  "headRefOid",
  "isCrossRepository",
  "isDraft",
  "labels",
  "latestReviews",
  "mergeable",
  "number",
  "reviewDecision",
  "reviews",
  "state",
  "statusCheckRollup",
  "title",
  "updatedAt",
  "url",
];

function usage() {
  console.error(
    "Usage: npm run fixtures:generate -- [owner/]repo#number [...]\n" +
      "Example: npm run fixtures:generate -- friday#37 sahilsk11/overwatch#9",
  );
}

function parsePullRequestRef(ref) {
  const match = /^(?:(?<owner>[^/\s#]+)\/)?(?<repo>[^/\s#]+)#(?<number>\d+)$/.exec(
    ref,
  );

  if (!match?.groups) {
    throw new Error(`Invalid pull request ref: ${ref}`);
  }

  return {
    owner: match.groups.owner ?? DEFAULT_OWNER,
    repo: match.groups.repo,
    number: Number(match.groups.number),
  };
}

function runGh(args) {
  const result = spawnSync("gh", args, {
    encoding: "utf8",
    maxBuffer: 1024 * 1024 * 100,
  });

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      [`gh ${args.join(" ")} failed`, result.stderr.trim(), result.stdout.trim()]
        .filter(Boolean)
        .join("\n"),
    );
  }

  return result.stdout;
}

async function writeFixture(ref) {
  const { owner, repo, number } = parsePullRequestRef(ref);
  const repoSlug = `${owner}/${repo}`;
  const fixtureDir = join(FIXTURE_ROOT, owner, repo, `pr-${number}`);

  const metadataJson = runGh([
    "pr",
    "view",
    String(number),
    "--repo",
    repoSlug,
    "--json",
    PR_FIELDS.join(","),
  ]);
  const metadata = JSON.parse(metadataJson);
  const diff = runGh(["pr", "diff", String(number), "--repo", repoSlug]);

  await mkdir(fixtureDir, { recursive: true });
  await writeFile(
    join(fixtureDir, "metadata.json"),
    `${JSON.stringify(
      {
        source: {
          provider: "github",
          owner,
          repo,
          number,
          url: metadata.url,
        },
        pullRequest: metadata,
      },
      null,
      2,
    )}\n`,
  );
  await writeFile(join(fixtureDir, "raw.diff"), diff.endsWith("\n") ? diff : `${diff}\n`);

  console.log(`Wrote ${repoSlug}#${number} -> ${fixtureDir}`);
}

const refs = process.argv.slice(2);

if (refs.length === 0) {
  usage();
  process.exitCode = 1;
} else {
  for (const ref of refs) {
    await writeFixture(ref);
  }
}
