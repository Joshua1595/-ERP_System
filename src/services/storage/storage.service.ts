import { IStorageProvider } from "./storage.interface.ts";
import { LocalStorageProvider } from "./local.provider.ts";
import { CloudinaryStorageProvider } from "./cloudinary.provider.ts";
import { prisma, checkDatabaseConnection, mockUploadedFiles } from "../../lib/db.ts";
import { NotFoundError } from "../../utils/errors.ts";

export class StorageService {
  private static provider: IStorageProvider;

  /**
   * Resolve and get the active Storage Provider based on environment variables
   */
  public static getProvider(): IStorageProvider {
    if (!this.provider) {
      const selected = process.env.STORAGE_PROVIDER?.toLowerCase() || "local";

      if (selected === "cloudinary") {
        this.provider = new CloudinaryStorageProvider();
      } else {
        this.provider = new LocalStorageProvider();
      }
    }
    return this.provider;
  }

  /**
   * Upload an incoming file, log its metadata to DB, and return details
   */
  public static async uploadFile(
    file: {
      buffer: Buffer;
      originalname: string;
      mimetype: string;
      size: number;
    },
    folder: string = "general"
  ) {
    const activeProvider = this.getProvider();
    
    // 1. Upload to physical storage (local or cloud)
    const { key, url, provider } = await activeProvider.uploadFile(file, folder);

    // 2. Save metadata to database (or mock fallback)
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const record = await prisma.uploadedFile.create({
          data: {
            filename: pathFilename(key),
            originalName: file.originalname,
            mimeType: file.mimetype,
            size: file.size,
            key,
            url,
            provider,
          },
        });
        return record;
      } catch (err) {
        console.error("Prisma error saving UploadedFile metadata, using mock fallback:", err);
      }
    }

    // Mock Fallback
    const id = "file-" + Math.random().toString(36).substring(2, 9);
    const mockRecord = {
      id,
      filename: pathFilename(key),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      key,
      url,
      provider,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockUploadedFiles.push(mockRecord);
    return mockRecord;
  }

  /**
   * Delete a file from storage and database registry
   */
  public static async deleteFile(id: string) {
    const fileRecord = await this.getFileById(id);
    const activeProvider = this.getProvider();

    // 1. Delete from physical storage
    await activeProvider.deleteFile(fileRecord.key);

    // 2. Delete database/mock record
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        await prisma.uploadedFile.delete({
          where: { id },
        });
        return;
      } catch (err) {
        console.error("Prisma error deleting UploadedFile metadata, using mock fallback:", err);
      }
    }

    // Mock Fallback
    const index = mockUploadedFiles.findIndex((f) => f.id === id);
    if (index !== -1) {
      mockUploadedFiles.splice(index, 1);
    }
  }

  /**
   * Fetch file metadata from DB
   */
  public static async getFileById(id: string) {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        const file = await prisma.uploadedFile.findUnique({
          where: { id },
        });
        if (file) return file;
      } catch (err) {
        console.error("Prisma error retrieving UploadedFile, using mock fallback:", err);
      }
    }

    // Mock Fallback
    const file = mockUploadedFiles.find((f) => f.id === id);
    if (!file) {
      throw new NotFoundError(`Uploaded file with ID "${id}" was not found.`);
    }
    return file;
  }

  /**
   * Retrieve all uploaded file logs (metadata)
   */
  public static async listAllFiles() {
    const isDbReachable = await checkDatabaseConnection();

    if (isDbReachable && prisma) {
      try {
        return await prisma.uploadedFile.findMany({
          orderBy: { createdAt: "desc" },
        });
      } catch (err) {
        console.error("Prisma error listing files, using mock fallback:", err);
      }
    }

    // Mock Fallback
    return [...mockUploadedFiles].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }
}

// Helper to extract clean filename
function pathFilename(key: string): string {
  const parts = key.split("/");
  return parts[parts.length - 1];
}
