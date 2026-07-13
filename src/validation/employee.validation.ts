import { z } from "zod";
import { UserRole, EmployeeStatus, AttendanceStatus } from "@prisma/client";

export const createEmployeeSchema = z.object({
  body: z.object({
    email: z.string().email("Invalid email address"),
    password: z.string().min(6, "Password must be at least 6 characters").optional(),
    role: z.nativeEnum(UserRole),
    firstName: z.string().min(1, "First name is required"),
    lastName: z.string().min(1, "Last name is required"),
    phone: z.string().optional(),
    address: z.string().optional(),
    departmentId: z.string().nullable().optional(),
    position: z.string().min(1, "Position is required"),
    salary: z.number().positive("Salary must be a positive number"),
    hireDate: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "hireDate must be a valid ISO DateTime string or Date string",
    }),
    profilePhotoUrl: z.string().url("Invalid photo URL format").or(z.string().length(0)).optional(),
  }),
});

export const updateEmployeeSchema = z.object({
  body: z.object({
    firstName: z.string().optional(),
    lastName: z.string().optional(),
    phone: z.string().optional(),
    address: z.string().optional(),
    departmentId: z.string().nullable().optional(),
    position: z.string().optional(),
    salary: z.number().positive("Salary must be a positive number").optional(),
    status: z.nativeEnum(EmployeeStatus).optional(),
    profilePhotoUrl: z.string().url("Invalid photo URL format").or(z.string().length(0)).optional(),
  }),
});

export const logAttendanceSchema = z.object({
  body: z.object({
    employeeId: z.string().min(1, "Employee ID is required"),
    date: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "date must be a valid ISO Date string",
    }),
    checkIn: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "checkIn must be a valid ISO Date string",
    }).nullable().optional(),
    checkOut: z.string().refine((val) => !isNaN(Date.parse(val)), {
      message: "checkOut must be a valid ISO Date string",
    }).nullable().optional(),
    status: z.nativeEnum(AttendanceStatus),
    notes: z.string().nullable().optional(),
  }),
});

export const issueSalaryPaymentSchema = z.object({
  body: z.object({
    employeeId: z.string().min(1, "Employee ID is required"),
    amount: z.number().positive("Salary payment amount must be positive"),
    payDate: z.string().refine((val) => !val || !isNaN(Date.parse(val)), {
      message: "payDate must be a valid ISO Date string",
    }).optional().default(() => new Date().toISOString()),
    paymentMethod: z.string().min(1, "Payment method is required"),
    status: z.string().optional().default("PAID"),
  }),
});
