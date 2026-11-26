import express from 'express';
import OrderController from './order.controller.js';

// Admin panel: view orders and change their status (no create / delete here).
// Mounted in server.js behind jwtAuth + isAdmin.
const orderAdminRouter = express.Router();

const orderController = new OrderController();

// every order, newest first
orderAdminRouter.get("/", (req, res, next) => {
    orderController.getAllOrders(req, res, next);
});

// one order with full details
orderAdminRouter.get("/:id", (req, res, next) => {
    orderController.getOrderById(req, res, next);
});

// change the status: body = { status: "Packed" | "Shipped" | "Delivered" | "Cancelled" }
orderAdminRouter.patch("/:id/status", (req, res, next) => {
    orderController.updateOrderStatus(req, res, next);
});

// handle a return: body = { action: "approve" | "reject" | "receive" | "refunded", note? }
orderAdminRouter.patch("/:id/return", (req, res, next) => {
    orderController.updateReturn(req, res, next);
});

// refund still owed on a cancelled online order: body = { mode: "retry" | "manual" }
orderAdminRouter.patch("/:id/refund", (req, res, next) => {
    orderController.settleCancelRefund(req, res, next);
});

export default orderAdminRouter;
