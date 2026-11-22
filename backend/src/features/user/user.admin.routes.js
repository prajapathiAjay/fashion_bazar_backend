import express from 'express';
import UserController from './user.controller.js';

// Admin panel: view customers only (no edit / block / delete here).
// Mounted in server.js behind jwtAuth + isAdmin.
const customerAdminRouter = express.Router();

const userController = new UserController();

// every shopper with order count and total spent
customerAdminRouter.get("/", (req, res, next) => {
    userController.getAllCustomers(req, res, next);
});

// one shopper with addresses and order history
customerAdminRouter.get("/:id", (req, res, next) => {
    userController.getCustomerById(req, res, next);
});

export default customerAdminRouter;
