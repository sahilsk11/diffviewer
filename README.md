# diffviewer

`diffviewer` is an early-stage project for higher-leverage code review.

The first product direction is to move beyond raw GitHub pull request diffs by
helping reviewers understand what changed, why it matters, and where the risky
or behaviorally important parts of a change are.

## Starting Point

- Accept a GitHub pull request link as input.
- Fetch and organize the changed files, commits, and discussion context.
- Explain the change at multiple levels: summary, subsystem impact, file-level
  details, and reviewer questions.
- Surface review targets that are hard to spot in a plain diff, such as
  behavior changes, test gaps, dependency changes, data model changes, security
  risks, and migration concerns.
- Keep the experience interactive so a reviewer can move between the big
  picture and the exact code evidence behind a claim.

## Notes

- No implementation stack has been selected yet.
- I attempted to check the old SAS server workspace for prior `diffviewer`
  work, but local SSH access is currently blocked because `/home/sahil/.ssh/sas`
  is missing.

## Frontend

The Phase 1 frontend is a minimal Vite React TypeScript scaffold. It exists so
later phases can add the static review workspace without introducing runtime
GitHub authentication.

```sh
npm install
npm run dev
npm run build
```

## GitHub Fixture Workflow

Fixtures are generated locally through the GitHub CLI. The app reads checked-in
fixture files; it does not handle GitHub tokens at runtime.

Prerequisites:

- Install the GitHub CLI.
- Authenticate locally with `gh auth login`.
- Ensure the authenticated account can read the target pull requests.

Generate the golden fixtures:

```sh
npm run fixtures:generate:golden
```

Generate specific fixtures:

```sh
npm run fixtures:generate -- friday#37 sahilsk11/overwatch#9
```

Pull request refs use `[owner/]repo#number`. If `owner` is omitted, the
generator defaults to `sahilsk11`.

Generated files are written under:

```text
fixtures/github/<owner>/<repo>/pr-<number>/
```

Each fixture directory contains:

- `metadata.json`: selected `gh pr view --json` metadata plus the source PR
  identity.
- `raw.diff`: raw `gh pr diff` output.

The initial Phase 1 fixtures are:

- `fixtures/github/sahilsk11/friday/pr-37/`
- `fixtures/github/sahilsk11/overwatch/pr-9/`
