import express from 'express';
import ShippingController from './shipping.controller.js';

const shippingController = new ShippingController();

// Public: shoppers' cart and checkout read the delivery options.
// Mounted at /api/shipping (no login needed).
export const shippingRouter = express.Router();
shippingRouter.get("/", (req, res) => shippingController.listPublic(req, res));

// Admin: create / edit / delete delivery options.
// Mounted at /api/admin/shipping behind jwtAuth + isAdmin.
export const shippingAdminRouter = express.Router();
shippingAdminRouter.get("/", (req, res) => shippingController.list(req, res));
shippingAdminRouter.get("/:id", (req, res) => shippingController.getById(req, res));
shippingAdminRouter.post("/", (req, res) => shippingController.create(req, res));
shippingAdminRouter.patch("/:id", (req, res) => shippingController.update(req, res));
shippingAdminRouter.delete("/:id", (req, res) => shippingController.remove(req, res));
