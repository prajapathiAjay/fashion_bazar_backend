import express from 'express';
import OrderController from './order.controller.js';

// Separate from order.routes.js because Razorpay's servers call this, not a logged-in user,
// so it must NOT go through jwtAuth. It is protected by the webhook signature instead.
const razorpayWebhookRouter = express.Router();

const orderController = new OrderController();

razorpayWebhookRouter.post("/", (req, res, next) => {
    orderController.razorpayWebhook(req, res, next);
});

export default razorpayWebhookRouter;
