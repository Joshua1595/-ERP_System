import { Router, Request, Response, NextFunction } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { db } from "../lib/db.ts";
import { prisma } from "../lib/db.ts";
import { supabaseAdmin } from "../lib/supabase.ts";
import { validate } from "../middleware/validate.ts";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { BadRequestError, ConflictError, UnauthorizedError, ForbiddenError } from "../utils/errors.ts";
import { UserRole } from "@prisma/client";
import { ActivityLogService } from "../services/activity-log.service.ts";

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || "super-secure-default-erp-secret-key-2026";
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || "super-secure-default-erp-refresh-secret-key-2026";
const SALT_ROUNDS = 10;

// Helper to generate access and refresh tokens
function generateTokens(payload: { userId: string; email: string; role: string }) {
  const accessToken = jwt.sign(
    { userId: payload.userId, email: payload.email, role: payload.role },
    JWT_SECRET,
    { expiresIn: "15m" }
  );

  const refreshToken = jwt.sign(
    { userId: payload.userId, email: payload.email, role: payload.role },
    JWT_REFRESH_SECRET,
    { expiresIn: "7d" }
  );

  return { accessToken, refreshToken };
}

// Static fallback permissions map for in-memory / local mode consistency
const mockPermissionsMap: Record<string, string[]> = {
  ADMIN: [
    "products.read", "products.write", "inventory.read", "inventory.update",
    "sales.read", "sales.write", "crm.read", "crm.write", "purchasing.read",
    "purchasing.write", "suppliers.read", "suppliers.write", "hr.read", "hr.write",
    "hr.self", "payroll.read", "payroll.write", "payroll.self", "finance.read",
    "finance.write", "logs.read", "system.admin"
  ],
  MANAGER: [
    "products.read", "products.write", "inventory.read", "inventory.update",
    "sales.read", "purchasing.read", "purchasing.write", "suppliers.read", "suppliers.write",
    "hr.self", "payroll.self"
  ],
  ACCOUNTANT: [
    "sales.read", "sales.write", "crm.read", "purchasing.read", "suppliers.read",
    "payroll.read", "payroll.write", "finance.read", "finance.write", "hr.self", "payroll.self"
  ],
  EMPLOYEE: [
    "hr.self", "payroll.self"
  ]
};

// ==========================================
// VALIDATION SCHEMAS
// ==========================================

const registerSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string()
      .min(8, "Password must be at least 8 characters long")
      .refine((val) => /[A-Z]/.test(val), "Password must contain at least one uppercase letter")
      .refine((val) => /[a-z]/.test(val), "Password must contain at least one lowercase letter")
      .refine((val) => /[0-9]/.test(val), "Password must contain at least one number")
      .refine((val) => /[^A-Za-z0-9]/.test(val), "Password must contain at least one special character"),
    role: z.nativeEnum(UserRole).default(UserRole.EMPLOYEE),
    firstName: z.string().min(2, "First name is too short"),
    lastName: z.string().min(2, "Last name is too short"),
  }),
});

const loginSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    password: z.string().min(1, "Password is required"),
  }),
});

const refreshSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

const logoutSchema = z.object({
  body: z.object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  }),
});

const changePasswordFirstTimeSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email format"),
    temporaryPassword: z.string().min(1, "Temporary password is required"),
    newPassword: z.string()
      .min(8, "Password must be at least 8 characters long")
      .refine((val) => /[A-Z]/.test(val), "Password must contain at least one uppercase letter")
      .refine((val) => /[a-z]/.test(val), "Password must contain at least one lowercase letter")
      .refine((val) => /[0-9]/.test(val), "Password must contain at least one number")
      .refine((val) => /[^A-Za-z0-9]/.test(val), "Password must contain at least one special character"),
  }),
});

// ==========================================
// ROUTES
// ==========================================

// PUBLIC: Get list of active sandboxed users for login page quick fill
router.get("/quick-fill-users", async (req: Request, res: Response, next: NextFunction) => {
  try {
    const users = await db.getUsers();
    // Return safe, sanitized data for login screen quick fill
    const safeUsers = users.map((u: any) => ({
      name: u.profile ? `${u.profile.firstName} ${u.profile.lastName}` : u.firstName ? `${u.firstName} ${u.lastName}` : u.email.split("@")[0],
      email: u.email,
      role: u.role,
      desc: u.role === "ADMIN" ? "System Administrator" :
            u.role === "MANAGER" ? "Warehouse operations control" :
            u.role === "ACCOUNTANT" ? "Ledgers & corporate books" :
            "General workspace staff"
    }));
    res.status(200).json({
      status: "success",
      data: { users: safeUsers }
    });
  } catch (error) {
    next(error);
  }
});

// Register a new user (Only Admins can register manually)
router.post(
  "/register",
  requireAuth,
  restrictTo(UserRole.ADMIN),
  validate(registerSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password, role, firstName, lastName } = req.body;

      // Check if user already exists
      const existingUser = await db.findUserByEmail(email);
      if (existingUser) {
        return next(new ConflictError("A user with this email address already exists."));
      }

      // Hash password using strong bcrypt algorithm for local database
      const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user and profile
      const user = await db.createUser({
        email,
        passwordHash,
        role,
        firstName,
        lastName,
      });

      res.status(201).json({
        status: "success",
        message: "User registered successfully",
        data: {
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName,
            lastName,
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Login Route
router.post(
  "/login",
  validate(loginSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, password } = req.body;

      let authSuccess = false;
      let suUser: any = null;

      // 1. Authenticate with Supabase Auth if active
      if (supabaseAdmin) {
        try {
          const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password
          });

          if (!error && data?.user) {
            authSuccess = true;
            suUser = data.user;
          } else if (error) {
            console.log(`ℹ️ Supabase Auth sign-in failed for ${email}: ${error.message}`);
          }
        } catch (suErr) {
          console.error("⚠️ Supabase Auth exception:", suErr);
        }
      }

      // Find user in local PostgreSQL
      let user: any = await db.findUserByEmail(email);

      // 2. Fallback to local bcrypt verification if Supabase auth didn't run or failed
      if (!authSuccess) {
        if (!user) {
          await ActivityLogService.log({
            action: "FAILED_LOGIN",
            userEmail: email,
            details: "Login failed: User email not found.",
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
            userAgent: req.headers["user-agent"] || null
          });
          return next(new UnauthorizedError("Invalid email or password credentials."));
        }

        const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
        if (!isPasswordValid) {
          await ActivityLogService.log({
            userId: user.id,
            userEmail: email,
            action: "FAILED_LOGIN",
            details: "Login failed: Invalid password.",
            ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
            userAgent: req.headers["user-agent"] || null
          });
          return next(new UnauthorizedError("Invalid email or password credentials."));
        }
        authSuccess = true;
      }

      // Double check user profile exists in PostgreSQL
      if (!user) {
        if (suUser) {
          user = await db.createUser({
            email,
            passwordHash: await bcrypt.hash(password, 10),
            role: (suUser.user_metadata?.role as UserRole) || UserRole.EMPLOYEE,
            firstName: suUser.user_metadata?.firstName || "New",
            lastName: suUser.user_metadata?.lastName || "Employee"
          });
        } else {
          return next(new UnauthorizedError("Invalid email or password credentials."));
        }
      }

      if (!user.isActive) {
        await ActivityLogService.log({
          userId: user.id,
          userEmail: email,
          action: "FAILED_LOGIN",
          details: "Login failed: Account is currently deactivated.",
          ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
          userAgent: req.headers["user-agent"] || null
        });
        return next(new UnauthorizedError("This account is currently deactivated."));
      }

      // 3. Force first-time password change if flag is true
      if (user.mustChangePassword) {
        return res.status(200).json({
          status: "must_change_password",
          message: "First-time login. Please change your temporary password.",
          data: {
            email: user.email
          }
        });
      }

      // Sign local tokens
      const { accessToken, refreshToken } = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      // Save refresh token
      await db.saveRefreshToken(refreshToken);

      await ActivityLogService.log({
        userId: user.id,
        userEmail: user.email,
        action: "LOGIN",
        details: `User logged in successfully with role ${user.role}.`,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null
      });

      const permissions = (user as any).roleRef?.permissions?.map((p: any) => p.permission.name)
        || mockPermissionsMap[user.role]
        || [];

      res.status(200).json({
        status: "success",
        message: "User authenticated successfully",
        data: {
          accessToken,
          refreshToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.profile?.firstName,
            lastName: user.profile?.lastName,
            profile: user.profile,
            permissions
          },
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// First-time Password Change Route
router.post(
  "/change-password-first-time",
  validate(changePasswordFirstTimeSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { email, temporaryPassword, newPassword } = req.body;

      const user: any = await db.findUserByEmail(email);
      if (!user) {
        return next(new BadRequestError("User not found."));
      }

      if (!user.mustChangePassword) {
        return next(new BadRequestError("Password has already been changed."));
      }

      let verified = false;

      // Validate temporary credentials and update password in Supabase
      if (supabaseAdmin) {
        try {
          const { data, error } = await supabaseAdmin.auth.signInWithPassword({
            email,
            password: temporaryPassword
          });
          if (!error && data?.user) {
            verified = true;
            
            const { error: updateErr } = await supabaseAdmin.auth.admin.updateUserById(data.user.id, {
              password: newPassword
            });
            if (updateErr) {
              console.error("❌ Failed to update password in Supabase Auth:", updateErr);
              throw updateErr;
            }
          }
        } catch (suErr: any) {
          console.error("❌ Supabase Auth password update error:", suErr);
          return next(new BadRequestError(`Failed to update password in Supabase: ${suErr.message || suErr}`));
        }
      }

      if (!verified) {
        // Fallback validation for local mode
        const isPasswordValid = await bcrypt.compare(temporaryPassword, user.passwordHash);
        if (!isPasswordValid) {
          return next(new UnauthorizedError("Invalid temporary password."));
        }
      }

      // Update password hash and clear flag in PostgreSQL
      const newPasswordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      if (db.isPrisma() && prisma) {
        await prisma.user.update({
          where: { email },
          data: {
            passwordHash: newPasswordHash,
            mustChangePassword: false
          }
        });
      } else {
        // Mock fallback
        const mockUser = (db as any).mockUsers?.find((u: any) => u.email.toLowerCase() === email.toLowerCase());
        if (mockUser) {
          mockUser.passwordHash = newPasswordHash;
          mockUser.mustChangePassword = false;
        }
      }

      await ActivityLogService.log({
        userId: user.id,
        userEmail: email,
        action: "PASSWORD_CHANGE",
        details: "User successfully changed their temporary password on first-time login.",
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null
      });

      res.status(200).json({
        status: "success",
        message: "Your password has been changed successfully. You can now log in.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Refresh Token Route
router.post(
  "/refresh",
  validate(refreshSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      let decoded: any;
      try {
        decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET);
      } catch (err) {
        return next(new UnauthorizedError("Invalid or expired refresh token. Please log in again."));
      }

      const hasToken = await db.hasRefreshToken(refreshToken);
      if (!hasToken) {
        return next(new UnauthorizedError("Refresh token is unrecognized or has been revoked. Please log in again."));
      }

      const user = await db.findUserByEmail(decoded.email);
      if (!user || !user.isActive) {
        return next(new UnauthorizedError("User is inactive or no longer exists."));
      }

      await db.revokeRefreshToken(refreshToken);

      const tokens = generateTokens({
        userId: user.id,
        email: user.email,
        role: user.role,
      });

      await db.saveRefreshToken(tokens.refreshToken);

      const permissions = (user as any).roleRef?.permissions?.map((p: any) => p.permission.name)
        || mockPermissionsMap[user.role]
        || [];

      res.status(200).json({
        status: "success",
        message: "Access token refreshed successfully (Token rotation triggered)",
        data: {
          accessToken: tokens.accessToken,
          refreshToken: tokens.refreshToken,
          user: {
            id: user.id,
            email: user.email,
            role: user.role,
            firstName: user.profile?.firstName,
            lastName: user.profile?.lastName,
            profile: user.profile,
            permissions
          }
        },
      });
    } catch (error) {
      next(error);
    }
  }
);

// Logout Route
router.post(
  "/logout",
  validate(logoutSchema),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { refreshToken } = req.body;

      let userId: string | null = null;
      let userEmail: string | null = null;
      try {
        const decoded = jwt.decode(refreshToken) as any;
        if (decoded) {
          userId = decoded.userId || null;
          userEmail = decoded.email || null;
        }
      } catch (err) {}

      await db.revokeRefreshToken(refreshToken);

      await ActivityLogService.log({
        userId,
        userEmail,
        action: "LOGOUT",
        details: "User logged out successfully. Session revoked.",
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null
      });

      res.status(200).json({
        status: "success",
        message: "User logged out successfully. Refresh token invalidated.",
      });
    } catch (error) {
      next(error);
    }
  }
);

// Get current logged in user details
router.get("/me", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userPayload = req.user!;
    const user = await db.findUserByEmail(userPayload.email);

    if (!user) {
      return next(new UnauthorizedError("User session is invalid."));
    }

    const permissions = (user as any).roleRef?.permissions?.map((p: any) => p.permission.name)
      || mockPermissionsMap[user.role]
      || [];

    res.status(200).json({
      status: "success",
      data: {
        user: {
          id: user.id,
          email: user.email,
          role: user.role,
          isActive: user.isActive,
          profile: user.profile,
          permissions
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Update current logged in user's profile
router.put("/profile", requireAuth, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const userPayload = req.user!;
    const { firstName, lastName, phone, address, profilePhotoUrl } = req.body;

    const user = await db.findUserByEmail(userPayload.email);
    if (!user) {
      return next(new UnauthorizedError("User session is invalid."));
    }

    const updatedUser = await db.updateUser(user.id, {
      firstName,
      lastName,
      phone,
      address,
      profilePhotoUrl
    });

    res.status(200).json({
      status: "success",
      message: "Profile updated successfully",
      data: {
        user: {
          id: updatedUser?.id,
          email: updatedUser?.email,
          role: updatedUser?.role,
          isActive: updatedUser?.isActive,
          profile: updatedUser?.profile
        }
      }
    });
  } catch (error) {
    next(error);
  }
});

// Demo Endpoints
router.get(
  "/admin-only",
  requireAuth,
  restrictTo(UserRole.ADMIN),
  async (req: Request, res: Response) => {
    res.status(200).json({
      status: "success",
      message: "Access Granted: Welcome to the Admin Panel!",
      data: {
        roleRequired: "ADMIN",
        user: req.user,
      },
    });
  }
);

router.get(
  "/manager-only",
  requireAuth,
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  async (req: Request, res: Response) => {
    res.status(200).json({
      status: "success",
      message: "Access Granted: Welcome to the Manager Dashboard!",
      data: {
        rolesRequired: ["ADMIN", "MANAGER"],
        user: req.user,
      },
    });
  }
);

router.get(
  "/employee-only",
  requireAuth,
  async (req: Request, res: Response) => {
    res.status(200).json({
      status: "success",
      message: "Access Granted: Welcome to the General Employee Hub!",
      data: {
        user: req.user,
      },
    });
  }
);

// ==========================================
// ADMIN USER LIFECYCLE MANAGEMENT ENDPOINTS
// ==========================================

// GET All Users (Admin Only)
router.get(
  "/users",
  requireAuth,
  restrictTo(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const users = await db.getUsers();
      res.status(200).json({
        status: "success",
        data: { users },
      });
    } catch (error) {
      next(error);
    }
  }
);

// UPDATE User Account Details, Roles, Blocking Status, and Passwords (Admin Only)
router.put(
  "/users/:id",
  requireAuth,
  restrictTo(UserRole.ADMIN),
  async (req: Request, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const { email, role, isActive, password, mustChangePassword, firstName, lastName } = req.body;

      // Prepare fields to update in database
      const updateFields: any = {};
      if (email !== undefined) updateFields.email = email;
      if (role !== undefined) updateFields.role = role;
      if (isActive !== undefined) updateFields.isActive = isActive;
      if (mustChangePassword !== undefined) updateFields.mustChangePassword = mustChangePassword;
      if (firstName !== undefined) updateFields.firstName = firstName;
      if (lastName !== undefined) updateFields.lastName = lastName;

      let passwordHash: string | undefined;
      if (password !== undefined && password !== "") {
        if (password.length < 8) {
          throw new BadRequestError("Password must be at least 8 characters long");
        }
        passwordHash = bcrypt.hashSync(password, SALT_ROUNDS);
        updateFields.passwordHash = passwordHash;
      }

      // Sync user profile updates with Supabase Auth if integrated
      if (supabaseAdmin) {
        try {
          const supabaseUpdate: any = {};
          if (email !== undefined) supabaseUpdate.email = email;
          if (password !== undefined && password !== "") supabaseUpdate.password = password;
          
          const meta: any = {};
          if (role !== undefined) meta.role = role;
          if (firstName !== undefined) meta.firstName = firstName;
          if (lastName !== undefined) meta.lastName = lastName;
          
          if (Object.keys(meta).length > 0) {
            supabaseUpdate.user_metadata = meta;
          }

          if (isActive !== undefined) {
            if (isActive === false) {
              supabaseUpdate.ban_duration = "876000h"; // block/ban account in Supabase
            } else {
              supabaseUpdate.ban_duration = "none"; // unblock/unban account
            }
          }

          if (Object.keys(supabaseUpdate).length > 0) {
            const { error: suErr } = await supabaseAdmin.auth.admin.updateUserById(id, supabaseUpdate);
            if (suErr) {
              console.warn(`⚠️ Warning syncing updates with Supabase: ${suErr.message}`);
            } else {
              console.log(`✅ Supabase Auth user ${id} synced successfully`);
            }
          }
        } catch (suErr: any) {
          console.error("❌ Failed to sync update to Supabase auth service:", suErr);
        }
      }

      // Update local storage / relational database
      const updatedUser = await db.updateUser(id, updateFields);

      if (!updatedUser) {
        throw new BadRequestError(`User with ID ${id} not found.`);
      }

      // Generate audit trail activity log
      await ActivityLogService.log({
        userId: req.user?.userId || null,
        userEmail: req.user?.email || null,
        action: "UPDATE",
        entityType: "USER",
        entityId: id,
        details: `Admin modified user account settings (ID: ${id}). Status changes: ${JSON.stringify({
          role,
          isActive,
          passwordUpdated: !!password,
          mustChangePassword,
          firstName,
          lastName,
        })}`,
        ipAddress: (req.headers["x-forwarded-for"] as string) || req.socket.remoteAddress || null,
        userAgent: req.headers["user-agent"] || null
      });

      res.status(200).json({
        status: "success",
        message: "User account updated successfully",
        data: { user: updatedUser },
      });
    } catch (error) {
      next(error);
    }
  }
);

export default router;
