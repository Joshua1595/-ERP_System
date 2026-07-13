import { db } from "../lib/db.ts";
import { NotFoundError, ConflictError, BadRequestError } from "../utils/errors.ts";
import bcrypt from "bcryptjs";
import { EmployeeStatus, AttendanceStatus, UserRole } from "@prisma/client";

export class EmployeeService {
  /**
   * Fetch paginated and searchable employee records
   */
  static async getEmployeesPaged(params: {
    page: number;
    limit: number;
    search?: string;
    departmentId?: string;
    status?: EmployeeStatus;
  }) {
    return await db.getEmployeesPaged(params);
  }

  /**
   * Fetch a single employee by ID
   */
  static async getEmployeeById(id: string) {
    const employee = await db.getEmployeeById(id);
    if (!employee) {
      throw new NotFoundError(`Employee with ID "${id}" does not exist.`);
    }
    return employee;
  }

  /**
   * Hire/create an employee along with their User and Profile records
   */
  static async createEmployee(data: {
    email: string;
    password?: string;
    role: UserRole;
    firstName: string;
    lastName: string;
    phone?: string;
    address?: string;
    departmentId?: string | null;
    position: string;
    salary: number;
    hireDate: Date;
    profilePhotoUrl?: string;
  }) {
    // Check if department exists if departmentId is provided
    if (data.departmentId) {
      const departments = await db.getDepartments();
      const deptExists = departments.some((d) => d.id === data.departmentId);
      if (!deptExists) {
        throw new BadRequestError(`Department with ID "${data.departmentId}" does not exist.`);
      }
    }

    const defaultPassword = data.password || "password123";
    const passwordHash = await bcrypt.hash(defaultPassword, 10);

    try {
      return await db.createEmployeeWithUser({
        email: data.email,
        passwordHash,
        plainPassword: defaultPassword,
        role: data.role,
        firstName: data.firstName,
        lastName: data.lastName,
        phone: data.phone,
        address: data.address,
        departmentId: data.departmentId,
        position: data.position,
        salary: data.salary,
        hireDate: data.hireDate,
        profilePhotoUrl: data.profilePhotoUrl,
      });
    } catch (error: any) {
      if (error.message && error.message.includes("already exists")) {
        throw new ConflictError(error.message);
      }
      throw error;
    }
  }

  /**
   * Update an employee's details, profile information, and status
   */
  static async updateEmployee(
    id: string,
    data: {
      departmentId?: string | null;
      position?: string;
      salary?: number;
      status?: EmployeeStatus;
      profilePhotoUrl?: string;
      firstName?: string;
      lastName?: string;
      phone?: string;
      address?: string;
    }
  ) {
    const employee = await db.getEmployeeById(id);
    if (!employee) {
      throw new NotFoundError(`Employee with ID "${id}" does not exist.`);
    }

    if (data.departmentId) {
      const departments = await db.getDepartments();
      const deptExists = departments.some((d) => d.id === data.departmentId);
      if (!deptExists) {
        throw new BadRequestError(`Department with ID "${data.departmentId}" does not exist.`);
      }
    }

    return await db.updateEmployee(id, data);
  }

  /**
   * Delete an employee (cascades to their User/Profile)
   */
  static async deleteEmployee(id: string) {
    const employee = await db.getEmployeeById(id);
    if (!employee) {
      throw new NotFoundError(`Employee with ID "${id}" does not exist.`);
    }
    return await db.deleteEmployee(id);
  }

  /**
   * Record or update employee attendance log
   */
  static async logAttendance(data: {
    employeeId: string;
    date: Date;
    checkIn?: Date | null;
    checkOut?: Date | null;
    status: AttendanceStatus;
    notes?: string | null;
  }) {
    const employee = await db.getEmployeeById(data.employeeId);
    if (!employee) {
      throw new NotFoundError(`Employee with ID "${data.employeeId}" does not exist.`);
    }
    return await db.createAttendance(data);
  }

  /**
   * Fetch paginated and filtered attendance logs
   */
  static async getAttendancesPaged(params: {
    page: number;
    limit: number;
    employeeId?: string;
    startDate?: Date;
    endDate?: Date;
  }) {
    if (params.employeeId) {
      const employee = await db.getEmployeeById(params.employeeId);
      if (!employee) {
        throw new NotFoundError(`Employee with ID "${params.employeeId}" does not exist.`);
      }
    }
    return await db.getAttendancesPaged(params);
  }

  /**
   * Log/issue a payroll salary payment
   */
  static async issueSalaryPayment(data: {
    employeeId: string;
    amount: number;
    payDate: Date;
    paymentMethod: string;
    status: string;
  }) {
    const employee = await db.getEmployeeById(data.employeeId);
    if (!employee) {
      throw new NotFoundError(`Employee with ID "${data.employeeId}" does not exist.`);
    }
    return await db.createSalaryPayment(data);
  }

  /**
   * Fetch paginated salary payments
   */
  static async getSalaryPaymentsPaged(params: {
    page: number;
    limit: number;
    employeeId?: string;
  }) {
    if (params.employeeId) {
      const employee = await db.getEmployeeById(params.employeeId);
      if (!employee) {
        throw new NotFoundError(`Employee with ID "${params.employeeId}" does not exist.`);
      }
    }
    return await db.getSalaryPaymentsPaged(params);
  }
}
