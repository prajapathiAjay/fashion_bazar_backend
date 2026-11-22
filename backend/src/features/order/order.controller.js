import OrderRepository from "./order.repository.js";
import { ApplicationError } from "../../error-handler/applicationError.js";


export default class OrderController {
    constructor() {
        this.orderRepository = new OrderRepository();
    }

    // async placeOrder(req, res, next){
    //     try{
    //         const userId = req.userID;
    //         await this.orderRepository.placeOrder(userId);
    //         res.status(201).send("Order is created");
    //     }catch(err){
    //         console.log(err);
    //         return res.status(200).send("Something went wrong");
    //     }
    // }


    async placeOrder(req, res, next) {
        const data = req.body
        try {
            const userId = req.userID;
            const response = await this.orderRepository.placeOrder(userId, data);
            return res.status(201).json({ success: true, message: "Order is created", data: response });
        } catch (error) {
            const status = error instanceof ApplicationError ? error.code : 500;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    async verifyPayment(req, res, next) {
        try {
            const order = await this.orderRepository.verifyPayment(req.userID, req.body);
            return res.status(201).json({ success: true, message: "Payment verified, order is created", data: order });
        } catch (error) {
            const status = error instanceof ApplicationError ? error.code : 500;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    // Razorpay calls this. Always answer quickly: 200 = done, 400 = bad signature, 500 = retry later.
    async razorpayWebhook(req, res, next) {
        try {
            const result = await this.orderRepository.handleWebhook(
                req.rawBody,
                req.headers["x-razorpay-signature"],
                req.body
            );
            return res.status(200).json({ success: true, ...result });
        } catch (error) {
            console.log("Razorpay webhook error:", error.message);
            const status = error instanceof ApplicationError ? error.code : 500;
            return res.status(status).json({ success: false, message: error.message });
        }
    }

    async getMyOrders(req, res, next) {
        try {
            const orders = await this.orderRepository.getMyOrders(req.userID);
            return res.status(200).json({ success: true, data: orders });
        } catch (error) {
            return res.status(500).json({ success: false, message: error.message });
        }
    }

    // ---------- Admin (view only) ----------

    // GET /api/admin/orders
    async getAllOrders(req, res, next) {
        try {
            const orders = await this.orderRepository.getAllOrders();
            return res.status(200).json({ success: true, data: orders });
        } catch (error) {
            console.log(error);
            return res.status(500).json({ success: false, message: "Could not load orders" });
        }
    }

    // GET /api/admin/orders/:id
    async getOrderById(req, res, next) {
        try {
            const order = await this.orderRepository.getOrderById(req.params.id);
            return res.status(200).json({ success: true, data: order });
        } catch (error) {
            const status = error instanceof ApplicationError ? error.code : 500;
            if (status === 500) console.log(error);
            return res.status(status).json({
                success: false,
                message: status === 500 ? "Could not load the order" : error.message,
            });
        }
    }

    // PATCH /api/admin/orders/:id/status   body: { status: "Packed" }
    async updateOrderStatus(req, res, next) {
        try {
            const { status } = req.body ?? {};
            if (!status) {
                return res.status(400).json({ success: false, message: "Status is required" });
            }
            const { order, refundFailed } = await this.orderRepository.updateOrderStatus(req.params.id, status);
            return res.status(200).json({
                success: true,
                message: refundFailed
                    ? "Order cancelled, but the refund failed. Please refund it from the Razorpay dashboard."
                    : `Order marked as ${order.status}`,
                refundFailed,
                data: order,
            });
        } catch (error) {
            const status = error instanceof ApplicationError ? error.code : 500;
            if (status === 500) console.log(error);
            return res.status(status).json({
                success: false,
                message: status === 500 ? "Could not update the order" : error.message,
            });
        }
    }
}
