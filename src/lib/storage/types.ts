export interface StorageProvider {
  /** Saves a file under a company/document scoped path and returns a storage-relative key. */
  save(params: {
    companyId: string;
    documentId: string;
    fileName: string;
    data: Buffer;
  }): Promise<string>;

  /** Reads back a previously saved file by its storage key. */
  read(key: string): Promise<Buffer>;

  /** Deletes a previously saved file. Safe to call on a missing file. */
  delete(key: string): Promise<void>;
}
