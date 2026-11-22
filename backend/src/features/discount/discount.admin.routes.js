import express from 'express';
import DiscountController from './discount.controller.js';

// Admin panel: manage coupon codes.
// Mounted in server.js behind jwtAuth + isAdmin.
const discountAdminRouter = express.Router();

const discountController = new DiscountController();

discountAdminRouter.get("/", (req, res) => discountController.getAll(req, res));
discountAdminRouter.get("/:id", (req, res) => discountController.getById(req, res));
discountAdminRouter.post("/", (req, res) => discountController.create(req, res));
discountAdminRouter.patch("/:id", (req, res) => discountController.update(req, res));
discountAdminRouter.delete("/:id", (req, res) => discountController.remove(req, res));

export default discountAdminRouter;
