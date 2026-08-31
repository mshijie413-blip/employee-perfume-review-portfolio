import assert from "node:assert/strict";
import test from "node:test";
import { ReviewStore } from "./review_domain.mjs";

function createStore() {
  return new ReviewStore({
    perfumes: [{ id: "P1", name: "木质样例", brand: "Demo", productCode: "D-001" }],
    reviewers: [{ externalUserId: "external-demo-1", reviewerId: "R1" }],
    reviews: [],
  });
}

test("unknown reviewer is rejected", () => {
  const store = createStore();
  assert.throws(() => store.submitReview({ externalUserId: "unknown", perfumeId: "P1", text: "测试", score: 4 }));
});

test("duplicate submission requires confirmation and overwrite resets AI state", () => {
  const store = createStore();
  const first = store.submitReview({ externalUserId: "external-demo-1", perfumeId: "P1", text: "第一版", score: 4 });
  assert.equal(first.status, "CREATED");
  store.reviews[0].aiStatus = "DONE";
  assert.equal(store.submitReview({ externalUserId: "external-demo-1", perfumeId: "P1", text: "第二版", score: 5 }).status, "DUPLICATE_CONFIRMATION_REQUIRED");
  const updated = store.submitReview({ externalUserId: "external-demo-1", perfumeId: "P1", text: "第二版", score: 5, overwrite: true });
  assert.equal(updated.status, "UPDATED");
  assert.equal(store.reviews[0].aiStatus, "PENDING_AI");
});

test("consensus uses approved reviews only", () => {
  const store = createStore();
  store.reviews = [
    { id: "1", perfumeId: "P1", reviewerId: "R1", score: 5, tags: ["木质", "干燥"], moderationStatus: "APPROVED" },
    { id: "2", perfumeId: "P1", reviewerId: "R2", score: 1, tags: ["未审核"], moderationStatus: "PENDING" },
  ];
  assert.deepEqual(store.consensus("P1"), { reviewCount: 1, averageScore: 5, topTags: ["干燥", "木质"] });
});
