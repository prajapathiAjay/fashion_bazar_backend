import express from 'express';
import OrderController from './order.controller.js';
// 2. Initialize Express router.
const orderRouter = express.Router();

const orderController = new OrderController();

orderRouter.post("/", (req, res, next)=>{
    orderController.placeOrder(req, res, next);
})

orderRouter.get("/", (req, res, next)=>{
    orderController.getMyOrders(req, res, next);
})

export default orderRouter;