import crypto from "crypto";
import mongoose from "mongoose";
import { OrderModel } from "./order.schema.js";
import { cartModel } from "../cartItems/cartItems.schema.js";
import { productSchema } from "../product/product.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";
import buildOrderData from "../../helper/buildOrderData.js";
import { razorpay } from "../../config/razorpay.js";
import DiscountRepository from "../discount/discount.repository.js";
const discountRepo = new DiscountRepository();
// Reuse the model if the product repository already registered it
const ProductModel = mongoose.models.Product || mongoose.model("Product", productSchema);

export default class OrderRepository {

    // data = { address, shipMethod, payMethod, couponCode? } from the checkout page
    // cod      -> creates the order right away
    // razorpay -> only creates a Razorpay order; our order is created after /verify-payment
    async placeOrder(userId, data = {}) {
        const { address, payMethod } = data;

        if (!["cod", "razorpay"].includes(payMethod)) {
            throw new ApplicationError("Invalid payment method", 400);
        }

        // 1. Validate and calculate (nothing saved yet)
        const orderData = await buildOrderData(userId, data);

        if (payMethod === "razorpay") {
            return await this.createRazorpayOrder(userId, orderData, address, orderData.shippingInfo.code);
        }

        // 2. COD: reduce stock, save the order, clear the cart
        return await this.createOrderAndReduceStock(userId, orderData, {
            paymentMethod: "cod",
            paymentStatus: "Pending",   // COD is paid on delivery
        });
    }

    // Asks Razorpay for an order (a "bill" waiting for payment). Nothing is saved in our DB.
    async createRazorpayOrder(userId, orderData, address, shipMethod) {
        try {
            const rzpOrder = await razorpay.orders.create({
                amount: Math.round(orderData.totalAmount * 100),   // rupees -> paise
                currency: "INR",
                receipt: `rcpt_${Date.now()}`,                     // max 40 chars
                // read back in /verify-payment, so we don't trust the browser for these
                notes: {
                    userId: String(userId),
                    addressId: String(address._id),
                    shipMethod,
                    couponCode: orderData.discountInfo?.code ?? "",
                },
            });

            return {
                razorpayOrderId: rzpOrder.id,
                amount: rzpOrder.amount,
                currency: rzpOrder.currency,
                keyId: process.env.RAZORPAY_KEY_ID,                 // public key, safe to send
            };
        } catch (err) {
            // Razorpay errors look like { statusCode, error: { description } }
            console.log(err?.error || err);
            throw new ApplicationError("Could not start the payment, please try again", 502);
        }
    }

    // Called after the Razorpay popup succeeds.
    // body = { razorpay_order_id, razorpay_payment_id, razorpay_signature }
    async verifyPayment(userId, body = {}) {
        const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = body;
        if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
            throw new ApplicationError("Payment details are missing", 400);
        }

        // 1. Check the signature: only Razorpay (and we) know the key secret,
        //    so a matching signature proves this payment really happened for this order.
        const expected = crypto
            .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
            .update(`${razorpay_order_id}|${razorpay_payment_id}`)
            .digest("hex");
        const isValid =
            expected.length === razorpay_signature.length &&
            crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(razorpay_signature));
        if (!isValid) throw new ApplicationError("Payment verification failed", 400);

        // 2. Create the order (or refund if we can't)
        return await this.fulfilPayment(razorpay_order_id, razorpay_payment_id, userId);
    }

    // Called by Razorpay's servers (not the browser) when a payment is captured.
    // Safety net for when the customer pays but closes the tab before /verify-payment runs.
    // rawBody = exact bytes Razorpay sent (the signature is calculated on these)
    async handleWebhook(rawBody, signature, body = {}) {
        const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
        if (!secret) {
            console.log("RAZORPAY_WEBHOOK_SECRET is not set, ignoring webhook");
            throw new ApplicationError("Webhook is not configured", 500);
        }

        // 1. Check it really came from Razorpay (signed with the webhook secret from the dashboard)
        const expected = crypto.createHmac("sha256", secret).update(rawBody || "").digest("hex");
        const isValid =
            typeof signature === "string" &&
            expected.length === signature.length &&
            crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(signature));
        if (!isValid) throw new ApplicationError("Invalid webhook signature", 400);

        // 2. We only care about successful payments
        if (body.event !== "payment.captured") return { handled: false, reason: "event ignored" };
        const payment = body.payload?.payment?.entity;
        if (!payment?.order_id) return { handled: false, reason: "payment has no order" };

        // 3. Same work as /verify-payment. If the browser already did it, this just finds the order.
        try {
            const order = await this.fulfilPayment(payment.order_id, payment.id);
            return { handled: true, orderNumber: order.orderNumber };
        } catch (err) {
            // 4xx = nothing more we can do (already refunded / not our order) -> tell Razorpay "ok".
            // 5xx is re-thrown so Razorpay retries the webhook later.
            if (err instanceof ApplicationError && err.code < 500) {
                console.log(`Webhook for ${payment.order_id}: ${err.message}`);
                return { handled: false, reason: err.message };
            }
            throw err;
        }
    }

    // Shared by /verify-payment and the webhook. Signature is already checked by the caller.
    // userId is passed only from /verify-payment (the logged-in user must own the payment).
    async fulfilPayment(razorpayOrderId, razorpayPaymentId, userId) {
        // 1. Already created? (double click / retry / webhook got here first) -> return the same order
        const existing = await this.findOrderByRazorpayId(razorpayOrderId);
        if (existing) return existing;

        // 2. Read back what was being bought from the notes we saved on the Razorpay order
        let rzpOrder;
        try {
            rzpOrder = await razorpay.orders.fetch(razorpayOrderId);
        } catch (err) {
            console.log(err?.error || err);
            throw new ApplicationError("Could not confirm the payment, please contact support", 502);
        }
        const ownerId = rzpOrder.notes?.userId;
        if (!ownerId) throw new ApplicationError("Not a store order", 400); // e.g. a payment link, leave it alone
        if (userId && ownerId !== String(userId)) {
            throw new ApplicationError("This payment does not belong to you", 403);
        }

        try {
            // 3. Recalculate from the current cart and make sure it matches what was paid
            const orderData = await buildOrderData(ownerId, {
                address: { _id: rzpOrder.notes.addressId },
                shipMethod: rzpOrder.notes.shipMethod,
                couponCode: rzpOrder.notes.couponCode || undefined,
            });
            if (Math.round(orderData.totalAmount * 100) !== rzpOrder.amount) {
                // cart changed while paying (e.g. in another tab)
                throw new ApplicationError("Your cart changed during payment", 409);
            }

            // 4. Save the order as Paid (reduces stock and clears the cart too)
            return await this.createOrderAndReduceStock(ownerId, orderData, {
                paymentMethod: "razorpay",
                paymentStatus: "Paid",
                paymentInfo: {
                    razorpayOrderId,
                    razorpayPaymentId,
                    paidAt: new Date(),
                },
            });
        } catch (err) {
            // The other path (browser or webhook) may have created it at the same moment:
            // then the cart is already empty / the unique index blocked a 2nd order. Not a real failure.
            const createdMeanwhile = await this.findOrderByRazorpayId(razorpayOrderId);
            if (createdMeanwhile) return createdMeanwhile;

            // Unexpected error (DB down...) -> don't refund, the webhook retry can still create the order
            if (!(err instanceof ApplicationError) || err.code >= 500) throw err;

            // Business problem (cart changed, out of stock, cart empty...) -> the customer paid
            // but can't get an order, so give the money back right away.
            console.log(`Refunding ${razorpayPaymentId} (${razorpayOrderId}): ${err.message}`);
            const refunded = await this.refundPayment(razorpayPaymentId, err.message);
            const rupees = rzpOrder.amount / 100;
            throw new ApplicationError(
                refunded
                    ? `We couldn't place your order: ${err.message}. Your payment of ₹${rupees} has been refunded and will reach you in 5-7 working days.`
                    : `We couldn't place your order: ${err.message}. Please contact support with payment ID ${razorpayPaymentId} for a refund.`,
                409
            );
        }
    }

    findOrderByRazorpayId(razorpayOrderId) {
        return OrderModel.findOne({ "paymentInfo.razorpayOrderId": razorpayOrderId });
    }

    // Full refund. Returns true if the money is (or already was) on its way back.
    async refundPayment(paymentId, reason) {
        try {
            const payment = await razorpay.payments.fetch(paymentId);
            if (payment.status === "refunded") return true;       // the other path already refunded it
            if (payment.status !== "captured") {
                // "authorized" = not captured yet; Razorpay auto-returns these, but flag it
                console.log(`Cannot refund ${paymentId}, status is ${payment.status}`);
                return false;
            }
            await razorpay.payments.refund(paymentId, { notes: { reason: String(reason).slice(0, 250) } });
            return true;
        } catch (err) {
            console.log(`Refund failed for ${paymentId}:`, err?.error || err);
            return false;
        }
    }

    // Helper 2: the part that changes the database.
    // orderData = what buildOrderData returned
    // extra     = { paymentMethod, paymentStatus, paymentInfo? }
    async createOrderAndReduceStock(userId, orderData, extra) {
        const { items, shippingAddress, subTotal, shipping, totalAmount, shippingInfo, discountInfo } = orderData;
        const { paymentMethod, paymentStatus, paymentInfo } = extra;

        // 1. Reduce stock. The {stock: {$gte}} check stops two orders buying the last piece.
        //    Your local MongoDB is not a replica set, so transactions aren't available:
        //    if one item fails, put back the stock already taken.
        const reduced = [];
        let couponClaimed = false;
        try {
            for (const item of items) {
                const result = await ProductModel.updateOne(
                    { _id: item.product, stock: { $gte: item.quantity } },
                    { $inc: { stock: -item.quantity } }
                );
                if (result.modifiedCount === 0) {
                    throw new ApplicationError(`${item.name} just went out of stock`, 400);
                }
                reduced.push(item);
            }

            // 1b. Count the coupon use (fails if its last use was just taken by another order)
            if (discountInfo) {
                couponClaimed = await discountRepo.claimUse(discountInfo.code, discountInfo.amount);
                if (!couponClaimed) {
                    throw new ApplicationError(`Coupon ${discountInfo.code} just ran out, please remove it and try again`, 409);
                }
            }

            // 2. Create the order
            const order = await OrderModel.create({
                orderNumber: await this.getNextOrderNumber(),
                user: userId,
                items,
                shippingAddress,
                shippingMethod: shippingInfo.code,
                shippingMethodName: shippingInfo.name,
                deliveryDays: { min: shippingInfo.minDays, max: shippingInfo.maxDays },
                paymentMethod,
                paymentStatus,
                paymentInfo,
                subTotal,
                shipping,
                discountCode: discountInfo?.code,
                discount: discountInfo?.amount ?? 0,
                totalAmount,
            });

            // 3. Clear the cart
            await cartModel.deleteMany({ userID: userId });

            return order;
        } catch (err) {
            for (const item of reduced) {
                await ProductModel.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
            }
            if (couponClaimed) await discountRepo.releaseUse(discountInfo.code, discountInfo.amount);
            // 11000 = duplicate key: this Razorpay order already has an order (caller handles it)
            if (err instanceof ApplicationError || err?.code === 11000) throw err;
            console.log(err);
            throw new ApplicationError("Something went wrong while placing the order", 500);
        }
    }

    // All orders of the logged-in user, newest first
    async getMyOrders(userId) {
        return await OrderModel.find({ user: userId }).sort({ createdAt: -1 });
    }

    // ---------- Admin (view only) ----------

    // Every order in the store, newest first, with the customer's name and email
    async getAllOrders() {
        return await OrderModel.find()
            .populate("user", "firstName lastName email")
            .sort({ createdAt: -1 });
    }

    // One order by its _id, with the customer's details
    async getOrderById(orderId) {
        if (!mongoose.Types.ObjectId.isValid(orderId)) {
            throw new ApplicationError("Order not found", 404);
        }
        const order = await OrderModel.findById(orderId)
            .populate("user", "firstName lastName email phone");
        if (!order) throw new ApplicationError("Order not found", 404);
        return order;
    }

    // Which status an order may move to from its current one.
    // Orders only go forward; they can be cancelled until they are shipped.
    // Delivered and Cancelled are final.
    static NEXT_STATUSES = {
        Ordered:   ["Packed", "Cancelled"],
        Packed:    ["Shipped", "Cancelled"],
        Shipped:   ["Delivered"],
        Delivered: [],
        Cancelled: [],
    };

    // Admin changes the order status.
    // - Delivered + COD  -> the cash was collected, so payment becomes Paid
    // - Cancelled        -> stock goes back; a paid online order is refunded through Razorpay
    async updateOrderStatus(orderId, newStatus) {
        const order = await this.getOrderById(orderId);
        const from = order.status;

        const allowed = OrderRepository.NEXT_STATUSES[from] ?? [];
        if (!allowed.includes(newStatus)) {
            throw new ApplicationError(`An order that is ${from} can't be changed to ${newStatus}`, 400);
        }

        const update = { status: newStatus };
        if (newStatus === "Delivered" && order.paymentMethod === "cod") {
            update.paymentStatus = "Paid";
        }

        // Only update if the status is still what we read: if two admins click at the same
        // moment, only one wins (so stock is never put back twice).
        const updated = await OrderModel.findOneAndUpdate(
            { _id: order._id, status: from },
            { $set: update },
            { new: true }
        ).populate("user", "firstName lastName email phone");
        if (!updated) {
            throw new ApplicationError("This order was just changed by someone else, please refresh", 409);
        }

        if (newStatus === "Cancelled") {
            // put the pieces back on sale
            for (const item of updated.items) {
                await ProductModel.updateOne({ _id: item.product }, { $inc: { stock: item.quantity } });
            }

            // give the coupon use back, so the shopper (and the usage limit) get it again
            if (updated.discountCode) {
                await discountRepo.releaseUse(updated.discountCode, updated.discount || 0);
            }

            // the customer paid online -> give the money back
            if (updated.paymentMethod === "razorpay" && updated.paymentStatus === "Paid") {
                const paymentId = updated.paymentInfo?.razorpayPaymentId;
                const refunded = paymentId
                    ? await this.refundPayment(paymentId, `Order ${updated.orderNumber} cancelled by admin`)
                    : false;
                if (refunded) {
                    updated.paymentStatus = "Refunded";
                    await updated.save();
                } else {
                    // order stays cancelled; the admin is told to refund from the Razorpay dashboard
                    return { order: updated, refundFailed: true };
                }
            }
        }

        return { order: updated, refundFailed: false };
    }

    // BZ-10001, BZ-10002, ... using an atomic counter so two orders never get the same number
    async getNextOrderNumber() {
        const counter = await mongoose.connection.db.collection("counters").findOneAndUpdate(
            { _id: "orderNumber" },
            { $inc: { value: 1 } },
            { upsert: true, returnDocument: "after" }
        );
        // driver v6 returns the doc, older versions return { value: doc }
        const value = (counter?.value?.value ?? counter?.value) || 1;
        return `BZ-${10000 + value}`;
    }
}
