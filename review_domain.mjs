import fs from "node:fs";
import { pathToFileURL } from "node:url";

export class ReviewStore {
  constructor({ perfumes = [], reviewers = [], reviews = [] } = {}) {
    this.perfumes = perfumes;
    this.reviewers = new Map(reviewers.map((item) => [item.externalUserId, item]));
    this.reviews = reviews;
    this.nextId = reviews.length + 1;
  }

  searchPerfumes(query) {
    const normalized = query.trim().toLocaleLowerCase();
    if (!normalized) return [];
    return this.perfumes.filter((item) =>
      [item.name, item.brand, item.productCode].some((value) =>
        String(value).toLocaleLowerCase().includes(normalized),
      ),
    );
  }

  resolveReviewer(externalUserId) {
    const reviewer = this.reviewers.get(externalUserId);
    if (!reviewer) throw new Error("reviewer is not in the approved mapping");
    return reviewer.reviewerId;
  }

  submitReview({ externalUserId, perfumeId, text, score, tags = [], overwrite = false }) {
    const reviewerId = this.resolveReviewer(externalUserId);
    if (!this.perfumes.some((item) => item.id === perfumeId)) throw new Error("unknown perfume");
    if (!text.trim()) throw new Error("review text is required");
    if (!Number.isInteger(score) || score < 1 || score > 5) throw new Error("score must be 1-5");

    const existing = this.reviews.find(
      (item) => item.reviewerId === reviewerId && item.perfumeId === perfumeId,
    );
    if (existing && !overwrite) {
      return { status: "DUPLICATE_CONFIRMATION_REQUIRED", reviewId: existing.id };
    }

    const values = {
      reviewerId,
      perfumeId,
      text: text.trim(),
      score,
      tags: [...new Set(tags.map((tag) => tag.trim()).filter(Boolean))].sort(),
      aiStatus: "PENDING_AI",
    };
    if (existing) {
      Object.assign(existing, values);
      return { status: "UPDATED", reviewId: existing.id };
    }

    const created = { id: `REVIEW-DEMO-${String(this.nextId++).padStart(3, "0")}`, ...values };
    this.reviews.push(created);
    return { status: "CREATED", reviewId: created.id };
  }

  consensus(perfumeId) {
    const approved = this.reviews.filter(
      (item) => item.perfumeId === perfumeId && item.moderationStatus === "APPROVED",
    );
    if (!approved.length) return { reviewCount: 0, averageScore: null, topTags: [] };
    const tagCounts = new Map();
    for (const review of approved) {
      for (const tag of review.tags) tagCounts.set(tag, (tagCounts.get(tag) ?? 0) + 1);
    }
    return {
      reviewCount: approved.length,
      averageScore: Number((approved.reduce((sum, item) => sum + item.score, 0) / approved.length).toFixed(2)),
      topTags: [...tagCounts.entries()]
        .sort((left, right) => right[1] - left[1] || left[0].localeCompare(right[0]))
        .slice(0, 3)
        .map(([tag]) => tag),
    };
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const source = process.argv[2] ?? "sample_data.json";
  const store = new ReviewStore(JSON.parse(fs.readFileSync(source, "utf8")));
  console.log(JSON.stringify({ search: store.searchPerfumes("木质"), consensus: store.consensus("PERFUME-DEMO-001") }, null, 2));
}
