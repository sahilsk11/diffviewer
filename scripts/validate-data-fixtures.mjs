import { createServer } from "vite";

const server = await createServer({
  appType: "custom",
  logLevel: "error",
  server: {
    middlewareMode: true,
  },
});

try {
  const { reviewViewModels } = await server.ssrLoadModule("/src/data/index.ts");
  const unresolved = reviewViewModels.flatMap((review) =>
    review.evidenceResolution
      .filter((resolution) => !resolution.resolved)
      .map((resolution) => ({
        reviewId: review.id,
        evidenceId: resolution.evidence.id,
        reason: resolution.reason,
      })),
  );

  if (unresolved.length > 0) {
    console.error("Unresolved evidence references:");
    for (const item of unresolved) {
      console.error(
        `- ${item.reviewId}: ${item.evidenceId} (${item.reason ?? "unknown"})`,
      );
    }
    process.exitCode = 1;
  } else {
    const evidenceCount = reviewViewModels.reduce(
      (count, review) => count + review.evidenceResolution.length,
      0,
    );
    console.log(
      `Validated ${reviewViewModels.length} review fixtures and ${evidenceCount} evidence references.`,
    );
  }
} finally {
  await server.close();
}
