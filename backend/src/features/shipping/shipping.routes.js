import express from 'express';
import ShippingController from './shipping.controller.js';

const shippingController = new ShippingController();

// Public: shoppers' cart and checkout read the current rates.
// Mounted at /api/shipping (no login needed).
export const shippingRouter = express.Router();
shippingRouter.get("/", (req, res) => shippingController.get(req, res));

// Admin: view and change the rates.
// Mounted at /api/admin/shipping behind jwtAuth + isAdmin.
export const shippingAdminRouter = express.Router();
shippingAdminRouter.get("/", (req, res) => shippingController.get(req, res));
shippingAdminRouter.patch("/", (req, res) => shippingController.update(req, res));
