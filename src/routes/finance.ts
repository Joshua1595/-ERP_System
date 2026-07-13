import { Router, Request, Response, NextFunction } from "express";
import { z } from "zod";
import { db } from "../lib/db.ts";
import { validate } from "../middleware/validate.ts";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { UserRole } from "@prisma/client";

const router = Router();

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const createJournalEntrySchema = z.object({
  body: z.object({
    description: z.string().min(5, "A descriptive entry explanation is required"),
    lines: z
      .array(
        z.object({
          accountId: z.string().min(1, "Account ID is required"),
          debit: z.number().nonnegative("Debit amount cannot be negative").default(0),
          credit: z.number().nonnegative("Credit amount cannot be negative").default(0),
          description: z.string().optional(),
        })
      )
      .min(2, "At least two entry lines (a debit and a credit) are required to satisfy double-entry accounting rules"),
  }),
});

// ==========================================
// ROUTES
// ==========================================

// Apply auth to all finance routes
router.use(requireAuth);

// Get Chart of Accounts (with current balances)
router.get("/accounts", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const accounts = await db.getAccounts();
    res.status(200).json({ status: "success", data: { accounts } });
  } catch (error) {
    next(error);
  }
});

// Get all general journal ledger entries (and double-entry items)
router.get("/journals", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const journals = await db.getJournalEntries();
    res.status(200).json({ status: "success", data: { journals } });
  } catch (error) {
    next(error);
  }
});

// Post a new Journal Entry (restricted to ADMIN or ACCOUNTANT roles)
router.post(
  "/journals",
  restrictTo(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(createJournalEntrySchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { description, lines } = req.body;
      const createdById = req.user!.userId;

      const journalEntry = await db.createJournalEntry({
        description,
        createdById,
        lines,
      });

      res.status(201).json({
        status: "success",
        message: "Double-entry general journal entry posted, and ledger accounts reconciled.",
        data: { journalEntry },
      });
    } catch (error) {
      // Pass accounting math rule mismatches or DB failures to error handler
      next(error);
    }
  }
);

export default router;
