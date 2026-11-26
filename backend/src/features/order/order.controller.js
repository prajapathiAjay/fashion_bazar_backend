import OrderRepository from "./order.repository.js";
import { ApplicationError } from "../../error-handler/applicationError.js";


export default class OrderController {
    constructor() {
        this.orderRepository = new OrderRepository();
    }



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

    // ApplicationErrors carry their own status (400 / 404 / 409); anything else is a 500
    sendError(res, error, fallback) {
        const status = error instanceof ApplicationError ? error.code : 500;
        if (status === 500) console.log(error);
        return res.status(status).json({ success: false, message: status === 500 ? fallback : error.message });
    }

    // POST /api/orders/:id/cancel   body: { reason? }   (shopper, before it ships)
    async cancelMyOrder(req, res) {
        try {
            const { order, refundFailed } = await this.orderRepository.cancelByCustomer(req.userID, req.params.id, req.body?.reason);
            return res.status(200).json({
                success: true,
                message: refundFailed
                    ? "Your order is cancelled. Your refund is delayed — our team will send it to you shortly."
                    : order.paymentStatus === "Refunded"
                        ? "Your order is cancelled. Your refund is on its way and reaches you in 5–7 working days."
                        : "Your order is cancelled.",
                data: order,
            });
        } catch (error) {
            return this.sendError(res, error, "Could not cancel the order. Please try again.");
        }
    }

    // POST /api/orders/:id/return   body: { reason, refundTo? }   (shopper, delivered order)
    async requestReturn(req, res) {
        try {
            const order = await this.orderRepository.requestReturn(req.userID, req.params.id, req.body ?? {});
            return res.status(200).json({
                success: true,
                message: "Return requested. We'll reply within 2 working days and arrange a pickup.",
                data: order,
            });
        } catch (error) {
            return this.sendError(res, error, "Could not request the return. Please try again.");
        }
    }

    // PATCH /api/admin/orders/:id/return   body: { action, note? }
    async updateReturn(req, res) {
        try {
            const { action, note } = req.body ?? {};
            const { order, refundFailed } = await this.orderRepository.updateReturn(req.params.id, action, note);
            const MESSAGES = {
                approve: "Return approved — arrange the pickup with the customer.",
                reject: "Return rejected. The customer can see your note.",
                receive: order.paymentMethod === "cod"
                    ? "Return received and items are back in stock. Now send the refund to the customer and mark it refunded."
                    : refundFailed
                        ? "Return received, but the Razorpay refund failed. Refund it from the Razorpay dashboard, then mark it refunded."
                        : "Return received, items are back in stock and the customer has been refunded.",
                refunded: "Refund marked as sent.",
            };
            return res.status(200).json({ success: true, message: MESSAGES[action], refundFailed, data: order });
        } catch (error) {
            return this.sendError(res, error, "Could not update the return");
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
