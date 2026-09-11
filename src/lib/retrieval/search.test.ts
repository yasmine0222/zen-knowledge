import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { embedText, toVectorLiteral } from "@/lib/ingestion/embed";
import { searchChunks } from "./search";

// Permission isolation at the retrieval layer itself: even when another
// tenant's chunk is a near-perfect semantic match, searchChunks() must never
// return it unless its documentId is in the caller's authorized id-set. The
// id-set is injected directly into the SQL WHERE clause (see search.ts) —
// this test proves that holds at the query level, not just in application code.

const suffix = randomUUID().slice(0, 8);
const SHARED_CONTENT = "Le mot de passe du serveur de secours est stocké dans le coffre-fort RH.";

let companyA: { id: string };
let companyB: { id: string };
let owner: { id: string };
let docA: { id: string };
let docB: { id: string };
let versionA: { id: string };
let versionB: { id: string };
let chunkA: { id: string };
let chunkB: { id: string };

beforeAll(async () => {
  companyA = await prisma.company.create({ data: { name: `Search Co A ${suffix}` } });
  companyB = await prisma.company.create({ data: { name: `Search Co B ${suffix}` } });
  owner = await prisma.user.create({
    data: {
      email: `search-owner-${suffix}@test.local`,
      passwordHash: "x",
      name: "Search Owner",
      role: "MEMBER",
      companyId: companyA.id,
    },
  });

  docA = await prisma.document.create({
    data: {
      companyId: companyA.id,
      ownerId: owner.id,
      title: "Doc A",
      visibility: "COMPANY",
      status: "PUBLISHED",
    },
  });
  docB = await prisma.document.create({
    data: {
      companyId: companyB.id,
      ownerId: owner.id,
      title: "Doc B",
      visibility: "COMPANY",
      status: "PUBLISHED",
    },
  });

  versionA = await prisma.documentVersion.create({
    data: { documentId: docA.id, version: 1, filePath: "n/a", mimeType: "text/plain", status: "READY" },
  });
  versionB = await prisma.documentVersion.create({
    data: { documentId: docB.id, version: 1, filePath: "n/a", mimeType: "text/plain", status: "READY" },
  });

  chunkA = await prisma.chunk.create({
    data: {
      documentVersionId: versionA.id,
      documentId: docA.id,
      companyId: companyA.id,
      content: SHARED_CONTENT,
      position: 0,
      isActive: true,
    },
  });
  chunkB = await prisma.chunk.create({
    data: {
      documentVersionId: versionB.id,
      documentId: docB.id,
      companyId: companyB.id,
      content: SHARED_CONTENT, // identical content -> identical/near-identical embedding
      position: 0,
      isActive: true,
    },
  });

  // The embedding column isn't part of the Prisma schema (raw SQL only, see
  // schema.prisma comment on Chunk) — set it directly.
  const vector = toVectorLiteral(await embedText(SHARED_CONTENT));
  await prisma.$executeRawUnsafe(
    `UPDATE chunks SET embedding = '${vector}'::vector WHERE id IN ('${chunkA.id}', '${chunkB.id}')`
  );
}, 60000);

afterAll(async () => {
  await prisma.chunk.deleteMany({ where: { id: { in: [chunkA.id, chunkB.id] } } });
  await prisma.documentVersion.deleteMany({ where: { id: { in: [versionA.id, versionB.id] } } });
  await prisma.document.deleteMany({ where: { id: { in: [docA.id, docB.id] } } });
  await prisma.user.delete({ where: { id: owner.id } });
  await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
});

describe("searchChunks — retrieval-layer isolation", () => {
  it("returns nothing when the authorized id-set is empty, without querying", async () => {
    const results = await searchChunks("mot de passe serveur de secours", []);
    expect(results).toEqual([]);
  });

  it("never returns a chunk from a document outside the authorized id-set, even with identical content", async () => {
    const results = await searchChunks("mot de passe serveur de secours", [docA.id], {
      minSimilarity: 0,
    });

    expect(results.length).toBeGreaterThan(0);
    expect(results.every((r) => r.documentId === docA.id)).toBe(true);
    expect(results.some((r) => r.documentId === docB.id)).toBe(false);
  });

  it("authorizing both documents surfaces both matching chunks", async () => {
    const results = await searchChunks("mot de passe serveur de secours", [docA.id, docB.id], {
      minSimilarity: 0,
    });

    const documentIds = results.map((r) => r.documentId);
    expect(documentIds).toContain(docA.id);
    expect(documentIds).toContain(docB.id);
  });
});
