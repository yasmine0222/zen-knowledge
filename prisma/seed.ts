import { readFile } from "node:fs/promises";
import path from "node:path";
import bcrypt from "bcryptjs";
import { PDFDocument } from "pdf-lib";
import { prisma } from "../src/lib/prisma";
import { storage } from "../src/lib/storage/local";
import { runIngestionPipeline } from "../src/lib/ingestion/pipeline";

const DEMO_DOCS_DIR = path.join(__dirname, "..", "demo-docs");
const DEMO_PASSWORD = "password123";

async function main() {
  console.log("Nettoyage de la base...");
  await prisma.$transaction([
    prisma.feedback.deleteMany(),
    prisma.message.deleteMany(),
    prisma.chatSession.deleteMany(),
    prisma.queryLog.deleteMany(),
    prisma.ingestionJob.deleteMany(),
    prisma.chunk.deleteMany(),
    prisma.documentVersion.deleteMany(),
    prisma.document.deleteMany(),
    prisma.user.deleteMany(),
    prisma.company.deleteMany(),
  ]);

  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const zenGroup = await prisma.company.create({ data: { name: "ZEN Group Tunisie" } });
  const acme = await prisma.company.create({ data: { name: "Acme Corp" } });

  const adminZen = await prisma.user.create({
    data: {
      email: "admin@zen-knowledge.local",
      passwordHash,
      name: "Sana Admin",
      role: "ADMIN",
      department: "RH",
      companyId: zenGroup.id,
    },
  });
  const memberRh = await prisma.user.create({
    data: {
      email: "rh@zen-knowledge.local",
      passwordHash,
      name: "Yassine RH",
      role: "MEMBER",
      department: "RH",
      companyId: zenGroup.id,
    },
  });
  const memberFinance = await prisma.user.create({
    data: {
      email: "finance@zen-knowledge.local",
      passwordHash,
      name: "Nour Finance",
      role: "MEMBER",
      department: "Finance",
      companyId: zenGroup.id,
    },
  });
  await prisma.user.create({
    data: {
      email: "sans-societe@zen-knowledge.local",
      passwordHash,
      name: "Compte Orphelin",
      role: "MEMBER",
      department: null,
      companyId: null,
    },
  });

  const adminAcme = await prisma.user.create({
    data: {
      email: "admin@acme.local",
      passwordHash,
      name: "Acme Admin",
      role: "ADMIN",
      department: null,
      companyId: acme.id,
    },
  });

  console.log("Ingestion des documents de démonstration...");

  await ingestMarkdown({
    file: "politique-conges.md",
    title: "Politique de congés payés",
    companyId: zenGroup.id,
    ownerId: adminZen.id,
    department: "RH",
    visibility: "COMPANY",
  });

  // Contradictory sources on purpose: both COMPANY-visible, both mention a
  // télétravail quota, but disagree (2 jours vs 3 jours). The assistant must
  // surface the contradiction rather than silently pick one.
  await ingestMarkdown({
    file: "politique-teletravail.md",
    title: "Politique de télétravail (RH)",
    companyId: zenGroup.id,
    ownerId: adminZen.id,
    department: "RH",
    visibility: "COMPANY",
  });
  await ingestMarkdown({
    file: "faq-rh-teletravail.md",
    title: "FAQ RH — Télétravail",
    companyId: zenGroup.id,
    ownerId: memberRh.id,
    department: "RH",
    visibility: "COMPANY",
  });

  // Department-scoped document: only Finance should retrieve this in chat.
  await ingestMarkdown({
    file: "procedure-notes-de-frais.md",
    title: "Procédure notes de frais (interne Finance)",
    companyId: zenGroup.id,
    ownerId: memberFinance.id,
    department: "Finance",
    visibility: "DEPARTMENT",
  });

  // Prompt-injection attempt embedded in otherwise normal content.
  await ingestMarkdown({
    file: "note-fournisseur-injection.md",
    title: "Note de service — Fournisseur IT",
    companyId: zenGroup.id,
    ownerId: adminZen.id,
    department: null,
    visibility: "COMPANY",
  });

  // Already past its review date -> populates the admin obsolescence queue.
  const obsoleteDoc = await ingestMarkdown({
    file: "guide-securite-postes-obsolete.md",
    title: "Guide de sécurité des postes de travail",
    companyId: zenGroup.id,
    ownerId: adminZen.id,
    department: "IT",
    visibility: "COMPANY",
  });
  await prisma.document.update({
    where: { id: obsoleteDoc.id },
    data: { reviewDueAt: daysFromNow(-30) },
  });

  // Empty/scanned PDF edge case: a genuinely valid PDF with no text content,
  // so extraction runs but yields nothing usable -> version marked FAILED.
  await ingestBlankPdf({
    title: "Rapport scanné (à OCR)",
    companyId: zenGroup.id,
    ownerId: adminZen.id,
    department: null,
    visibility: "COMPANY",
  });

  // Cross-tenant isolation fixture: Acme's document must never surface for ZEN Group users.
  await ingestMarkdown({
    file: "acme-politique-conges.md",
    title: "Politique de congés payés",
    companyId: acme.id,
    ownerId: adminAcme.id,
    department: null,
    visibility: "COMPANY",
  });

  console.log("\nComptes de démonstration (mot de passe pour tous: password123):");
  console.log("  admin@zen-knowledge.local        (ADMIN, ZEN Group Tunisie, RH)");
  console.log("  rh@zen-knowledge.local            (MEMBER, ZEN Group Tunisie, RH)");
  console.log("  finance@zen-knowledge.local       (MEMBER, ZEN Group Tunisie, Finance)");
  console.log("  sans-societe@zen-knowledge.local  (MEMBER, aucune société — cas limite)");
  console.log("  admin@acme.local                  (ADMIN, Acme Corp — isolation cross-tenant)");
  console.log(`\nUtilisateurs: ${memberFinance.id}, mémorisez ceci si besoin pour les tests.`);
}

async function ingestMarkdown(opts: {
  file: string;
  title: string;
  companyId: string;
  ownerId: string;
  department: string | null;
  visibility: "COMPANY" | "DEPARTMENT" | "PRIVATE";
}) {
  const data = await readFile(path.join(DEMO_DOCS_DIR, opts.file));
  const document = await prisma.document.create({
    data: {
      companyId: opts.companyId,
      ownerId: opts.ownerId,
      title: opts.title,
      department: opts.department,
      visibility: opts.visibility,
      status: "DRAFT",
      reviewDueAt: daysFromNow(365),
    },
  });

  const filePath = await storage.save({
    companyId: opts.companyId,
    documentId: document.id,
    fileName: opts.file,
    data,
  });

  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version: 1,
      filePath,
      mimeType: "text/markdown",
      status: "PROCESSING",
    },
  });

  await runIngestionPipeline(version.id);
  console.log(`  ✓ ${opts.title}`);
  return document;
}

async function ingestBlankPdf(opts: {
  title: string;
  companyId: string;
  ownerId: string;
  department: string | null;
  visibility: "COMPANY" | "DEPARTMENT" | "PRIVATE";
}) {
  const pdfDoc = await PDFDocument.create();
  pdfDoc.addPage([595, 842]); // blank A4 page, no text content at all
  const bytes = await pdfDoc.save();

  const document = await prisma.document.create({
    data: {
      companyId: opts.companyId,
      ownerId: opts.ownerId,
      title: opts.title,
      department: opts.department,
      visibility: opts.visibility,
      status: "DRAFT",
      reviewDueAt: daysFromNow(365),
    },
  });

  const filePath = await storage.save({
    companyId: opts.companyId,
    documentId: document.id,
    fileName: "scan.pdf",
    data: Buffer.from(bytes),
  });

  const version = await prisma.documentVersion.create({
    data: {
      documentId: document.id,
      version: 1,
      filePath,
      mimeType: "application/pdf",
      status: "PROCESSING",
    },
  });

  try {
    await runIngestionPipeline(version.id);
  } catch {
    // Expected: this is the "scanned/empty PDF" edge case, it should fail ingestion.
  }
  console.log(`  ✓ ${opts.title} (échec d'ingestion attendu — cas limite PDF scanné)`);
  return document;
}

function daysFromNow(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d;
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
