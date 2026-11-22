import express from 'express';
import OrderController from './order.controller.js';
// 2. Initialize Express router.
const orderRouter = express.Router();

const orderController = new OrderController();

// after the Razorpay popup succeeds
orderRouter.post("/verify-payment", (req, res, next)=>{
    orderController.verifyPayment(req, res, next);
})

orderRouter.post("/", (req, res, next)=>{
    orderController.placeOrder(req, res, next);
})

orderRouter.get("/", (req, res, next)=>{
    orderController.getMyOrders(req, res, next);
})

export default orderRouter;