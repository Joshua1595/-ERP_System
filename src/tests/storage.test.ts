import { StorageService } from "../services/storage/storage.service.ts";
import { LocalStorageProvider } from "../services/storage/local.provider.ts";
import { CloudinaryStorageProvider } from "../services/storage/cloudinary.provider.ts";
import { db, mockUploadedFiles, mockProducts, mockInvoices, mockEmployees, mockProfiles } from "../lib/db.ts";
import * as fs from "fs/promises";
import * as path from "path";
import { existsSync } from "fs";

let passedTests = 0;
let failedTests = 0;

async function runTest(name: string, testFn: () => Promise<void>) {
  const start = Date.now();
  try {
    console.log(`\n🧪 Running: ${name}`);
    await testFn();
    const duration = Date.now() - start;
    console.log(`   ✅ PASSED [${duration}ms]`);
    passedTests++;
  } catch (err: any) {
    const duration = Date.now() - start;
    console.error(`   ❌ FAILED [${duration}ms]`);
    console.error(`      Error: ${err.message}`);
    if (err.stack) console.error(`      Stack: ${err.stack}`);
    failedTests++;
  }
}

async function runAllTests() {
  console.log("=================================================");
  console.log("📂 STARTING ERP FILE UPLOAD & CLOUD STORAGE TESTS");
  console.log("=================================================");

  // Ensure mock lists have some baseline records for relationship tests
  const productTestId = "pr-steel"; // exists in default mocks
  const invoiceTestId = "inv-1"; // exists in default mocks
  
  // Ensure we have an employee for association
  const employeeTestId = "emp-test-id";
  const userTestId = "u-manager";
  mockEmployees.push({
    id: employeeTestId,
    userId: userTestId,
    departmentId: "d-1",
    position: "Manager",
    salary: 5000,
    hireDate: new Date(),
    status: "ACTIVE",
    createdAt: new Date(),
    updatedAt: new Date(),
  });
  mockProfiles.push({
    id: "prof-test-id",
    userId: userTestId,
    firstName: "John",
    lastName: "Doe",
    phone: "123",
    address: "Detroit",
    profilePhotoUrl: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  });

  await runTest("LocalStorageProvider uploads file and creates relative files on disk", async () => {
    const provider = new LocalStorageProvider();
    const sampleBuffer = Buffer.from("Showcasing File Upload Content");
    
    const result = await provider.uploadFile({
      buffer: sampleBuffer,
      originalname: "test-photo.png",
      mimetype: "image/png",
    }, "test_folder");

    if (result.provider !== "local") throw new Error("Expected provider to be 'local'");
    if (!result.key.startsWith("test_folder/")) throw new Error(`Incorrect key prefix: ${result.key}`);
    if (!result.url.includes("/api/storage/files/test_folder/")) throw new Error(`Incorrect relative url: ${result.url}`);

    // Verify file actually written to uploads/test_folder/
    const diskPath = path.join(process.cwd(), "uploads", result.key);
    if (!existsSync(diskPath)) {
      throw new Error(`File was not created on disk at path: ${diskPath}`);
    }

    const fileContent = await fs.readFile(diskPath, "utf-8");
    if (fileContent !== "Showcasing File Upload Content") {
      throw new Error(`File content mismatch. Read: ${fileContent}`);
    }

    // Clean up
    await provider.deleteFile(result.key);
    if (existsSync(diskPath)) {
      throw new Error("File was not deleted from disk after deleteFile call");
    }
  });

  await runTest("CloudinaryStorageProvider returns valid Cloudinary URLs", async () => {
    process.env.CLOUDINARY_CLOUD_NAME = "erp-prod-cloud";
    process.env.CLOUDINARY_API_KEY = "123456789";
    process.env.CLOUDINARY_API_SECRET = "abcdefghi";

    const cloudinaryProvider = new CloudinaryStorageProvider();
    const sampleBuffer = Buffer.from("Cloudinary data");

    const result = await cloudinaryProvider.uploadFile({
      buffer: sampleBuffer,
      originalname: "receipt.png",
      mimetype: "image/png"
    }, "receipts");

    if (result.provider !== "cloudinary") throw new Error("Expected Cloudinary provider name when configured");
    if (!result.url.startsWith("https://res.cloudinary.com/erp-prod-cloud/image/upload/")) {
      throw new Error(`Expected clean Cloudinary URL, got ${result.url}`);
    }

    delete process.env.CLOUDINARY_CLOUD_NAME;
    delete process.env.CLOUDINARY_API_KEY;
    delete process.env.CLOUDINARY_API_SECRET;
  });

  await runTest("StorageService can upload files and automatically logs metadata to database registry", async () => {
    mockUploadedFiles.length = 0; // Clear uploaded files log
    process.env.STORAGE_PROVIDER = "local";

    const file = {
      buffer: Buffer.from("Showcasing metadata test"),
      originalname: "test-attachment.xlsx",
      mimetype: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      size: 50,
    };

    const record = await StorageService.uploadFile(file, "finance");

    if (!record.id) throw new Error("Expected uploaded file to have registry ID");
    if (record.originalName !== "test-attachment.xlsx") throw new Error("Original name mismatch");
    if (record.mimeType !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet") throw new Error("Mimetype mismatch");
    if (record.size !== 50) throw new Error("Size mismatch");
    if (mockUploadedFiles.length !== 1) throw new Error("Expected exactly 1 file metadata record to be registered in DB/mock");

    // Retrieve file log
    const retrieved = await StorageService.getFileById(record.id);
    if (retrieved.id !== record.id) throw new Error("Failed to retrieve file from database registry");

    // Clean up
    await StorageService.deleteFile(record.id);
    if (mockUploadedFiles.length > 0) throw new Error("Expected registry to be empty after deletion");
  });

  await runTest("Employee Profile Photo upload successfully associates with Employee in database", async () => {
    const profile = mockProfiles.find((p) => p.userId === userTestId);
    if (!profile) throw new Error("Profile not seeded");
    profile.profilePhotoUrl = null; // Reset to null to verify update cleanly

    const uploadedUrl = "/api/storage/files/employees/avatar-123.jpg";
    
    // Associate URL
    const updatedEmployee = await db.updateEmployee(employeeTestId, {
      profilePhotoUrl: uploadedUrl,
    });

    const updatedProfile = mockProfiles.find((p) => p.userId === userTestId);
    if (!updatedProfile || updatedProfile.profilePhotoUrl !== uploadedUrl) {
      throw new Error(`Expected photo URL to be updated to ${uploadedUrl}, but got ${updatedProfile?.profilePhotoUrl}`);
    }
  });

  await runTest("Product Image upload successfully associates with Product in database", async () => {
    const product = mockProducts.find((p) => p.id === productTestId);
    if (!product) throw new Error("Product not seeded");

    const imageUrl = "/api/storage/files/products/steel-beam.png";

    // Associate URL
    const updatedProduct = await db.updateProduct(productTestId, {
      imageUrl,
    });

    if (!updatedProduct || (updatedProduct as any).imageUrl !== imageUrl) {
      throw new Error("imageUrl was not updated on the Product record");
    }

    // Verify inside store
    const productInStore = mockProducts.find((p) => p.id === productTestId);
    if ((productInStore as any).imageUrl !== imageUrl) {
      throw new Error("imageUrl was not persistent inside database/mock");
    }
  });

  await runTest("Invoice Attachment upload successfully associates with Invoice in database", async () => {
    const invoice = mockInvoices.find((i) => i.id === invoiceTestId);
    if (!invoice) throw new Error("Invoice not seeded");

    const attachmentUrl = "/api/storage/files/invoices/signed-po.pdf";

    // Associate URL
    const updatedInvoice = await db.updateInvoiceAttachment(invoiceTestId, attachmentUrl);

    if (!updatedInvoice || updatedInvoice.attachmentUrl !== attachmentUrl) {
      throw new Error("attachmentUrl was not updated on the Invoice record");
    }

    // Verify inside store
    const invoiceInStore = mockInvoices.find((i) => i.id === invoiceTestId);
    if (invoiceInStore.attachmentUrl !== attachmentUrl) {
      throw new Error("attachmentUrl was not persistent inside database/mock");
    }
  });

  console.log("=================================================");
  console.log("📂 FILE UPLOAD SUITE RESULTS");
  console.log(`   ✅ Passed: ${passedTests}`);
  console.log(`   ❌ Failed: ${failedTests}`);
  console.log("=================================================");

  if (failedTests > 0) {
    process.exit(1);
  }
}

runAllTests().catch((err) => {
  console.error("Test runner crashed:", err);
  process.exit(1);
});
