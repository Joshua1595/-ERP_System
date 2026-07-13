import { Request, Response, NextFunction } from "express";
import { CustomerService } from "../services/customer.service.ts";

export class CustomerController {
  /**
   * Get paginated customers list
   */
  static async getCustomersPaged(req: Request, res: Response, next: NextFunction) {
    try {
      const page = req.query.page ? parseInt(req.query.page as string, 10) : 1;
      const limit = req.query.limit ? parseInt(req.query.limit as string, 10) : 10;
      const search = req.query.search as string | undefined;

      const result = await CustomerService.getCustomersPaged({ page, limit, search });

      res.status(200).json({
        status: "success",
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get detailed customer record by ID (includes purchase history)
   */
  static async getCustomerById(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const customer = await CustomerService.getCustomerById(id);

      res.status(200).json({
        status: "success",
        data: { customer },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Create a new customer
   */
  static async createCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { companyName, contactName, email, phone, address } = req.body;

      const customer = await CustomerService.createCustomer({
        companyName,
        contactName,
        email,
        phone,
        address,
      });

      res.status(201).json({
        status: "success",
        message: "Customer created successfully.",
        data: { customer },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update an existing customer
   */
  static async updateCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      const { companyName, contactName, email, phone, address } = req.body;

      const customer = await CustomerService.updateCustomer(id, {
        companyName,
        contactName,
        email,
        phone,
        address,
      });

      res.status(200).json({
        status: "success",
        message: "Customer updated successfully.",
        data: { customer },
      });
    } catch (error) {
      next(error);
    }
  }

  /**
   * Soft delete a customer
   */
  static async deleteCustomer(req: Request, res: Response, next: NextFunction) {
    try {
      const { id } = req.params;
      await CustomerService.deleteCustomer(id);

      res.status(200).json({
        status: "success",
        message: "Customer soft-deleted successfully.",
      });
    } catch (error) {
      next(error);
    }
  }
}
