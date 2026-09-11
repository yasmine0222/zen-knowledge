import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { randomUUID } from "node:crypto";
import { env } from "@/lib/env";
import type { StorageProvider } from "./types";

/**
 * Stores files on the local filesystem under STORAGE_DIR/<companyId>/<documentId>/.
 * Swap for an S3-backed StorageProvider (same interface) when moving off single-instance hosting.
 */
export class LocalStorageProvider implements StorageProvider {
  private root: string;

  constructor(root = env.STORAGE_DIR) {
    this.root = path.resolve(root);
  }

  async save({
    companyId,
    documentId,
    fileName,
    data,
  }: {
    companyId: string;
    documentId: string;
    fileName: string;
    data: Buffer;
  }): Promise<string> {
    const safeName = `${randomUUID()}-${fileName.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const relDir = path.join(companyId, documentId);
    const absDir = path.join(this.root, relDir);
    await mkdir(absDir, { recursive: true });
    const relKey = path.join(relDir, safeName);
    await writeFile(path.join(this.root, relKey), data);
    return relKey.split(path.sep).join("/");
  }

  async read(key: string): Promise<Buffer> {
    return readFile(path.join(this.root, key));
  }

  async delete(key: string): Promise<void> {
    await rm(path.join(this.root, key), { force: true });
  }
}

export const storage: StorageProvider = new LocalStorageProvider();
