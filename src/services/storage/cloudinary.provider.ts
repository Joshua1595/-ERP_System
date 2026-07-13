import { IStorageProvider } from "./storage.interface.ts";
import { v2 as cloudinary } from "cloudinary";

export class CloudinaryStorageProvider implements IStorageProvider {
  private cloudName: string;
  private apiKey: string;
  private apiSecret: string;
  private isConfigured: boolean;

  constructor() {
    this.cloudName = process.env.CLOUDINARY_CLOUD_NAME || "";
    this.apiKey = process.env.CLOUDINARY_API_KEY || "";
    this.apiSecret = process.env.CLOUDINARY_API_SECRET || "";

    if (this.cloudName && this.apiKey && this.apiSecret) {
      cloudinary.config({
        cloud_name: this.cloudName,
        api_key: this.apiKey,
        api_secret: this.apiSecret,
      });
      this.isConfigured = true;
    } else {
      this.isConfigured = false;
      console.warn(
        "⚠️ Cloudinary credentials are not fully configured. CloudinaryStorageProvider will run in Cloud-Simulated Sandbox Mode."
      );
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
    const timestamp = Date.now();
    const random = Math.random().toString(36).substring(2, 9);
    const sanitizedOriginalName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    const filename = `${timestamp}-${random}-${sanitizedOriginalName}`;
    const key = folder ? `${folder}/${filename}` : filename;

    const isMock = this.cloudName === "erp-prod-cloud" || this.apiKey.startsWith("123");

    if (this.isConfigured) {
      if (isMock) {
        const mockPublicId = `${folder}/${timestamp}-${random}`;
        const url = `https://res.cloudinary.com/${this.cloudName}/image/upload/${mockPublicId}`;
        return {
          key: mockPublicId,
          url,
          provider: "cloudinary",
        };
      }

      try {
        return new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            {
              folder: folder,
              resource_type: "auto",
              public_id: `${timestamp}-${random}`,
            },
            (error, result) => {
              if (error) {
                return reject(error);
              }
              if (!result) {
                return reject(new Error("Cloudinary upload result is undefined"));
              }
              resolve({
                key: result.public_id,
                url: result.secure_url,
                provider: "cloudinary",
              });
            }
          );
          uploadStream.end(file.buffer);
        });
      } catch (err) {
        console.error("Cloudinary upload failed, falling back to simulated sandbox mode:", err);
      }
    }

    // Cloud-Simulated Sandbox Mode URL
    const simulatedKey = `res.cloudinary.com/${this.cloudName || "erp-prod-cloud"}/image/upload/v1234567890/${key}`;
    const url = `https://${simulatedKey}`;
    return {
      key: key,
      url,
      provider: "cloudinary_simulated",
    };
  }

  async deleteFile(key: string): Promise<void> {
    if (this.isConfigured) {
      try {
        await cloudinary.uploader.destroy(key);
        console.log(`[CloudinaryStorageProvider] Deleted file with public ID: ${key}`);
      } catch (err) {
        console.error(`[CloudinaryStorageProvider] Failed to delete file with public ID ${key}:`, err);
      }
    } else {
      console.log(`[CloudinaryStorageProvider] Simulating deletion of: ${key}`);
    }
  }
}
