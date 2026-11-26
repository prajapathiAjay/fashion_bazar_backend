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

// shopper cancels before it ships / asks to return a delivered order (own orders only)
orderRouter.post("/:id/cancel", (req, res, next)=>{
    orderController.cancelMyOrder(req, res, next);
})

orderRouter.post("/:id/return", (req, res, next)=>{
    orderController.requestReturn(req, res, next);
})

orderRouter.get("/", (req, res, next)=>{
    orderController.getMyOrders(req, res, next);
})

export default orderRouter;