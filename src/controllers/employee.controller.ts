import { Request, Response, NextFunction } from "express";
import { EmployeeService } from "../services/employee.service.ts";
import { EmployeeStatus, AttendanceStatus, UserRole } from "@prisma/client";

export class EmployeeController {
  /**
   * Get all employees (paginated, searchable, filterable)
   */
  static async getEmployees(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const search = (req.query.search as string) || undefined;
      const departmentId = (req.query.departmentId as string) || undefined;
      const status = (req.query.status as EmployeeStatus) || undefined;

      const { employees, total } = await EmployeeService.getEmployeesPaged({
        page,
        limit,
        search,
        departmentId,
        status,
      });

      res.status(200).json({
        status: "success",
        total,
        page,
        limit,
        data: { employees },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get single employee by ID
   */
  static async getEmployeeById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const employee = await EmployeeService.getEmployeeById(id);

      res.status(200).json({
        status: "success",
        data: { employee },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Hire/Create an employee
   */
  static async createEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const {
        email,
        password,
        role,
        firstName,
        lastName,
        phone,
        address,
        departmentId,
        position,
        salary,
        hireDate,
        profilePhotoUrl,
      } = req.body;

      const employee = await EmployeeService.createEmployee({
        email,
        password,
        role: role as UserRole,
        firstName,
        lastName,
        phone,
        address,
        departmentId,
        position,
        salary: Number(salary),
        hireDate: new Date(hireDate),
        profilePhotoUrl,
      });

      res.status(201).json({
        status: "success",
        message: "Employee successfully created",
        data: { employee },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update employee details
   */
  static async updateEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const {
        departmentId,
        position,
        salary,
        status,
        profilePhotoUrl,
        firstName,
        lastName,
        phone,
        address,
      } = req.body;

      const updatedEmployee = await EmployeeService.updateEmployee(id, {
        departmentId,
        position,
        salary: salary !== undefined ? Number(salary) : undefined,
        status: status as EmployeeStatus,
        profilePhotoUrl,
        firstName,
        lastName,
        phone,
        address,
      });

      res.status(200).json({
        status: "success",
        message: "Employee successfully updated",
        data: { employee: updatedEmployee },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Terminate/delete an employee record
   */
  static async deleteEmployee(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await EmployeeService.deleteEmployee(id);

      res.status(200).json({
        status: "success",
        message: "Employee successfully deleted",
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Log/issue daily attendance record
   */
  static async logAttendance(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, date, checkIn, checkOut, status, notes } = req.body;

      const attendance = await EmployeeService.logAttendance({
        employeeId,
        date: new Date(date),
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        status: status as AttendanceStatus,
        notes,
      });

      res.status(201).json({
        status: "success",
        message: "Attendance successfully recorded",
        data: { attendance },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get attendance logs
   */
  static async getAttendances(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const employeeId = (req.query.employeeId as string) || undefined;
      const startDate = req.query.startDate ? new Date(req.query.startDate as string) : undefined;
      const endDate = req.query.endDate ? new Date(req.query.endDate as string) : undefined;

      const { attendances, total } = await EmployeeService.getAttendancesPaged({
        page,
        limit,
        employeeId,
        startDate,
        endDate,
      });

      res.status(200).json({
        status: "success",
        total,
        page,
        limit,
        data: { attendances },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Record/issue salary payroll payments
   */
  static async issueSalaryPayment(req: Request, res: Response, next: NextFunction) {
    try {
      const { employeeId, amount, payDate, paymentMethod, status } = req.body;

      const salaryPayment = await EmployeeService.issueSalaryPayment({
        employeeId,
        amount: Number(amount),
        payDate: new Date(payDate),
        paymentMethod,
        status,
      });

      res.status(201).json({
        status: "success",
        message: "Salary payment successfully recorded",
        data: { salaryPayment },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get salary payroll payments
   */
  static async getSalaryPayments(req: Request, res: Response, next: NextFunction) {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 10;
      const employeeId = (req.query.employeeId as string) || undefined;

      const { salaryPayments, total } = await EmployeeService.getSalaryPaymentsPaged({
        page,
        limit,
        employeeId,
      });

      res.status(200).json({
        status: "success",
        total,
        page,
        limit,
        data: { salaryPayments },
      });
    } catch (error) {
      next(error);
    }
  }
}
