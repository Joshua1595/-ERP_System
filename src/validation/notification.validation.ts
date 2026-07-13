import { z } from "zod";
import { UserRole } from "@prisma/client";

export const getNotificationsSchema = z.object({
  query: z.object({
    isRead: z.string().optional().refine((val) => !val || val === "true" || val === "false", {
      message: "isRead must be 'true' or 'false'",
    }),
    type: z.string().optional(),
    role: z.nativeEnum(UserRole).optional(),
  }),
});

export const createNotificationSchema = z.object({
  body: z.object({
    userId: z.string().uuid().nullable().optional(),
    role: z.nativeEnum(UserRole).nullable().optional(),
    type: z.string().min(1, "Notification type is required"),
    title: z.string().min(1, "Title is required").max(150, "Title is too long"),
    message: z.string().min(1, "Message is required"),
    referenceId: z.string().nullable().optional(),
  }),
});

export const notificationIdSchema = z.object({
  params: z.object({
    id: z.string().min(1, "Notification ID is required"),
  }),
});
