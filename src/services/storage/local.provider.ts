import { IStorageProvider } from "./storage.interface.ts";
import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

export class LocalStorageProvider implements IStorageProvider {
  private uploadDir: string;
  private apiBaseUrl: string;

  constructor() {
    // Set the base directory for local uploads
    this.uploadDir = path.join(process.cwd(), "uploads");
    
    // We can configure the API Base URL. By default, it's relative
    // so it works in both dev (port 3000) and production cloud environments.
    this.apiBaseUrl = "/api/storage/files";
  }

  private async ensureDir(): Promise<void> {
    if (!existsSync(this.uploadDir)) {
      await fs.mkdir(this.uploadDir, { recursive: true });
    }
  }

  async uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
    },
    folder: string = "general"
  ): Promise<{ key: string; url: string; provider: string }> {
    await this.ensureDir();

    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${random}-${sanitizedOriginalName}`;
    
    // Construct target path (e.g. uploads/employees/filename)
    const relativeKey = folder ? path.join(folder, filename) : filename;
    const absolutePath = path.join(this.uploadDir, relativeKey);
    const parentDir = path.dirname(absolutePath);

    // Ensure the specific folder directory exists
    if (!existsSync(parentDir)) {
      await fs.mkdir(parentDir, { recursive: true });
    }

    // Write file to local disk
    await fs.writeFile(absolutePath, file.buffer);

    // URL to retrieve the file via our express download endpoint
    const fileKey = relativeKey.replace(/\\/g, "/"); // normalize windows paths
    const url = `${this.apiBaseUrl}/${fileKey}`;

    return {
      key: fileKey,
      url,
      provider: "local",
    };
  }

  async deleteFile(key: string): Promise<void> {
    const absolutePath = path.join(this.uploadDir, key);
    try {
      if (existsSync(absolutePath)) {
        await fs.unlink(absolutePath);
      }
    } catch (err) {
      console.error(`Failed to delete local file at ${absolutePath}:`, err);
    }
  }
}
