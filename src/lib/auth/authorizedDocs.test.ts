import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getAuthorizedDocumentIds } from "./authorizedDocs";

// Permission isolation tests, required by the spec: "Filtrage par
// société/rôle appliqué à la requête vectorielle ; tests d'isolation
// obligatoires." These exercise getAuthorizedDocumentIds() directly — the
// id-set that gets injected into the vector search's SQL WHERE clause.

const suffix = randomUUID().slice(0, 8);

let companyA: { id: string };
let companyB: { id: string };
let ownerA: { id: string };
let docCompanyA: { id: string };
let docDeptHrA: { id: string };
let docDeptFinanceA: { id: string };
let docPrivateOwnedByOwnerA: { id: string };
let docDraftA: { id: string };
let docCompanyB: { id: string };

beforeAll(async () => {
  companyA = await prisma.company.create({ data: { name: `Test Co A ${suffix}` } });
  companyB = await prisma.company.create({ data: { name: `Test Co B ${suffix}` } });

  ownerA = await prisma.user.create({
    data: {
      email: `owner-a-${suffix}@test.local`,
      passwordHash: "x",
      name: "Owner A",
      role: "MEMBER",
      companyId: companyA.id,
      department: "RH",
    },
  });

  docCompanyA = await prisma.document.create({
    data: {
      companyId: companyA.id,
      ownerId: ownerA.id,
      title: "Company-wide doc A",
      visibility: "COMPANY",
      status: "PUBLISHED",
    },
  });
  docDeptHrA = await prisma.document.create({
    data: {
      companyId: companyA.id,
      ownerId: ownerA.id,
      title: "RH-only doc A",
      visibility: "DEPARTMENT",
      department: "RH",
      status: "PUBLISHED",
    },
  });
  docDeptFinanceA = await prisma.document.create({
    data: {
      companyId: companyA.id,
      ownerId: ownerA.id,
      title: "Finance-only doc A",
      visibility: "DEPARTMENT",
      department: "Finance",
      status: "PUBLISHED",
    },
  });
  docPrivateOwnedByOwnerA = await prisma.document.create({
    data: {
      companyId: companyA.id,
      ownerId: ownerA.id,
      title: "Private doc owned by Owner A",
      visibility: "PRIVATE",
      status: "PUBLISHED",
    },
  });
  docDraftA = await prisma.document.create({
    data: {
      companyId: companyA.id,
      ownerId: ownerA.id,
      title: "Draft doc A (not yet published)",
      visibility: "COMPANY",
      status: "DRAFT",
    },
  });
  docCompanyB = await prisma.document.create({
    data: {
      companyId: companyB.id,
      ownerId: ownerA.id, // ownerId FK just needs to exist; company scoping is on document.companyId
      title: "Company-wide doc B",
      visibility: "COMPANY",
      status: "PUBLISHED",
    },
  });
});

afterAll(async () => {
  await prisma.document.deleteMany({ where: { companyId: { in: [companyA.id, companyB.id] } } });
  await prisma.user.delete({ where: { id: ownerA.id } });
  await prisma.company.deleteMany({ where: { id: { in: [companyA.id, companyB.id] } } });
});

describe("getAuthorizedDocumentIds — permission isolation", () => {
  it("a user with no company gets zero document access", async () => {
    const ids = await getAuthorizedDocumentIds({
      id: "no-company-user",
      companyId: null,
      role: "MEMBER",
      department: null,
    });
    expect(ids).toEqual([]);
  });

  it("never returns another company's documents, even a COMPANY-visible one", async () => {
    const ids = await getAuthorizedDocumentIds({
      id: ownerA.id,
      companyId: companyA.id,
      role: "MEMBER",
      department: "RH",
    });
    expect(ids).not.toContain(docCompanyB.id);
  });

  it("includes COMPANY-visible documents in the user's own company", async () => {
    const ids = await getAuthorizedDocumentIds({
      id: ownerA.id,
      companyId: companyA.id,
      role: "MEMBER",
      department: "RH",
    });
    expect(ids).toContain(docCompanyA.id);
  });

  it("includes DEPARTMENT-visible documents matching the user's department only", async () => {
    const idsRh = await getAuthorizedDocumentIds({
      id: ownerA.id,
      companyId: companyA.id,
      role: "MEMBER",
      department: "RH",
    });
    expect(idsRh).toContain(docDeptHrA.id);
    expect(idsRh).not.toContain(docDeptFinanceA.id);

    const idsFinance = await getAuthorizedDocumentIds({
      id: "some-finance-user",
      companyId: companyA.id,
      role: "MEMBER",
      department: "Finance",
    });
    expect(idsFinance).toContain(docDeptFinanceA.id);
    expect(idsFinance).not.toContain(docDeptHrA.id);
  });

  it("excludes PRIVATE documents from users other than the owner, includes them for the owner", async () => {
    const idsOwner = await getAuthorizedDocumentIds({
      id: ownerA.id,
      companyId: companyA.id,
      role: "MEMBER",
      department: "RH",
    });
    expect(idsOwner).toContain(docPrivateOwnedByOwnerA.id);

    const idsOther = await getAuthorizedDocumentIds({
      id: "another-user-same-company",
      companyId: companyA.id,
      role: "MEMBER",
      department: "RH",
    });
    expect(idsOther).not.toContain(docPrivateOwnedByOwnerA.id);
  });

  it("excludes documents that are not PUBLISHED (e.g. still DRAFT)", async () => {
    const ids = await getAuthorizedDocumentIds({
      id: ownerA.id,
      companyId: companyA.id,
      role: "MEMBER",
      department: "RH",
    });
    expect(ids).not.toContain(docDraftA.id);
  });

  it("a user with no department never sees DEPARTMENT-scoped documents", async () => {
    const ids = await getAuthorizedDocumentIds({
      id: "no-dept-user",
      companyId: companyA.id,
      role: "MEMBER",
      department: null,
    });
    expect(ids).not.toContain(docDeptHrA.id);
    expect(ids).not.toContain(docDeptFinanceA.id);
    expect(ids).toContain(docCompanyA.id);
  });
});
