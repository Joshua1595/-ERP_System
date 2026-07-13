import { Router } from "express";
import { db } from "../lib/db.ts";
import { validate } from "../middleware/validate.ts";
import { requireAuth, restrictTo } from "../middleware/auth.ts";
import { UserRole } from "@prisma/client";
import { EmployeeController } from "../controllers/employee.controller.ts";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  logAttendanceSchema,
  issueSalaryPaymentSchema,
} from "../validation/employee.validation.ts";
import { z } from "zod";

const router = Router();

// Apply auth to all HR routes
router.use(requireAuth);

// ==========================================
// DEPARTMENT ENDPOINTS
// ==========================================

const createDepartmentSchema = z.object({
  body: z.object({
    name: z.string().min(2, "Department name must be at least 2 characters"),
    code: z.string().min(2, "Department code must be at least 2 characters (e.g. SCM, FIN)"),
    description: z.string().optional(),
  }),
});

// Get all departments
router.get("/departments", async (req, res, next) => {
  try {
    const departments = await db.getDepartments();
    res.status(200).json({ status: "success", data: { departments } });
  } catch (error) {
    next(error);
  }
});

// Create department (Admin / Manager only)
router.post(
  "/departments",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(createDepartmentSchema),
  async (req, res, next) => {
    try {
      const { name, code, description } = req.body;
      const department = await db.createDepartment({ name, code, description });
      res.status(201).json({ status: "success", message: "Department created successfully", data: { department } });
    } catch (error) {
      next(error);
    }
  }
);

// ==========================================
// EMPLOYEE CRUD ENDPOINTS
// ==========================================

// Search & Get paginated employees
router.get("/employees", EmployeeController.getEmployees);

// Get single employee by ID
router.get("/employees/:id", EmployeeController.getEmployeeById);

// Hire/Create Employee (Admin / Manager only)
router.post(
  "/employees",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(createEmployeeSchema),
  EmployeeController.createEmployee
);

// Update Employee (Admin / Manager only)
router.patch(
  "/employees/:id",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER),
  validate(updateEmployeeSchema),
  EmployeeController.updateEmployee
);

// Terminate/Delete Employee (Admin only)
router.delete(
  "/employees/:id",
  restrictTo(UserRole.ADMIN),
  EmployeeController.deleteEmployee
);

// ==========================================
// ATTENDANCE ENDPOINTS
// ==========================================

// Log Attendance (Admin / Manager or self)
router.post(
  "/attendance",
  restrictTo(UserRole.ADMIN, UserRole.MANAGER, UserRole.EMPLOYEE),
  validate(logAttendanceSchema),
  EmployeeController.logAttendance
);

// Get Attendance records (Admin / Manager see all, employees can filter)
router.get(
  "/attendance",
  EmployeeController.getAttendances
);

// ==========================================
// PAYROLL / SALARY ENDPOINTS
// ==========================================

// Issue Salary Payment (Admin / Accountant only)
router.post(
  "/salaries",
  restrictTo(UserRole.ADMIN, UserRole.ACCOUNTANT),
  validate(issueSalaryPaymentSchema),
  EmployeeController.issueSalaryPayment
);

// Get Salary Payments (Admin, Accountant, or employee self filter)
router.get(
  "/salaries",
  EmployeeController.getSalaryPayments
);

// ==========================================
// TASKS ENDPOINTS
// ==========================================

// Get all tasks
router.get("/tasks", async (req, res, next) => {
  try {
    const tasks = await db.getTasks();
    res.status(200).json({ status: "success", data: { tasks } });
  } catch (error) {
    next(error);
  }
});

// Create task (Admin or Manager only)
router.post("/tasks", restrictTo(UserRole.ADMIN, UserRole.MANAGER), async (req, res, next) => {
  try {
    const { title, desc } = req.body;
    if (!title || !desc) {
      return res.status(400).json({ status: "fail", message: "Title and details are required." });
    }
    const task = await db.createTask({ title, desc });
    res.status(201).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
});

// Toggle task completeness (Admin, Manager, or Employee self)
router.patch("/tasks/:id/toggle", async (req, res, next) => {
  try {
    const { id } = req.params;
    const task = await db.toggleTask(id);
    if (!task) {
      return res.status(404).json({ status: "fail", message: "Task not found." });
    }
    res.status(200).json({ status: "success", data: { task } });
  } catch (error) {
    next(error);
  }
});

// Delete task (Admin or Manager only)
router.delete("/tasks/:id", restrictTo(UserRole.ADMIN, UserRole.MANAGER), async (req, res, next) => {
  try {
    const { id } = req.params;
    const deleted = await db.deleteTask(id);
    if (!deleted) {
      return res.status(404).json({ status: "fail", message: "Task not found." });
    }
    res.status(200).json({ status: "success", message: "Task successfully revoked." });
  } catch (error) {
    next(error);
  }
});

// ==========================================
// LEAVE REQUESTS ENDPOINTS
// ==========================================

// Get all leave requests
router.get("/leaves", async (req, res, next) => {
  try {
    const leaves = await db.getLeaveRequests();
    res.status(200).json({ status: "success", data: { leaves } });
  } catch (error) {
    next(error);
  }
});

// Create leave request (Employee self / any role)
router.post("/leaves", async (req, res, next) => {
  try {
    const { type, start, end, reason } = req.body;
    if (!type || !start || !end || !reason) {
      return res.status(400).json({ status: "fail", message: "All leave request fields are required." });
    }
    const leave = await db.createLeaveRequest({ type, start, end, reason });
    res.status(201).json({ status: "success", data: { leave } });
  } catch (error) {
    next(error);
  }
});

// Approve/Reject leave request (Admin or Manager only)
router.patch("/leaves/:id/status", restrictTo(UserRole.ADMIN, UserRole.MANAGER), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { status } = req.body; // APPROVED or REJECTED
    if (status !== "APPROVED" && status !== "REJECTED") {
      return res.status(400).json({ status: "fail", message: "Status must be APPROVED or REJECTED" });
    }
    const leave = await db.updateLeaveRequestStatus(id, status);
    if (!leave) {
      return res.status(404).json({ status: "fail", message: "Leave request not found." });
    }
    res.status(200).json({ status: "success", data: { leave } });
  } catch (error) {
    next(error);
  }
});

export default router;
