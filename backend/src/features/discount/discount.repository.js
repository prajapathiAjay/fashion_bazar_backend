import mongoose from "mongoose";
import { DiscountModel } from "./discount.schema.js";
import { OrderModel } from "../order/order.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

// Fields the admin may set (used / totalDiscountGiven are only changed by checkout)
const EDITABLE = [
    "code", "description", "type", "value", "maxDiscount", "minOrder",
    "usageLimit", "perCustomer", "startsAt", "endsAt", "isActive",
];

// "2026-12-01" from the date picker -> start / end of that day
const toDate = (value, endOfDay = false) => {
    if (value === null || value === undefined || value === "") return null;
    if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
        // the shop runs on Indian time: the coupon starts at midnight IST and ends at 23:59 IST that day,
        // whatever time zone the server is in (hosts usually run on UTC)
        return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}+05:30`);
    }
    const d = new Date(value);
    if (isNaN(d)) throw new ApplicationError("Invalid date", 400);
    return d;
};

export default class DiscountRepository {

    // Keep only allowed fields and check the rules the schema can't
    clean(body = {}, existing = null) {
        const data = {};
        for (const key of EDITABLE) if (key in body) data[key] = body[key];

        if ("startsAt" in data) data.startsAt = toDate(data.startsAt);
        if ("endsAt" in data) data.endsAt = toDate(data.endsAt, true);

        // look at the final values (new ones, or the saved ones when editing)
        const final = { ...(existing?.toObject?.() ?? {}), ...data };

        if (final.type === "percentage" && final.value > 90) {
            throw new ApplicationError("Percentage can't be more than 90%", 400);
        }
        if (final.type === "fixed") {
            data.maxDiscount = null;                       // a cap only makes sense for %
            if (final.minOrder && final.value >= final.minOrder) {
                throw new ApplicationError("Flat discount must be less than the minimum order", 400);
            }
        }
        if (final.startsAt && final.endsAt && final.endsAt < final.startsAt) {
            throw new ApplicationError("End date is before the start date", 400);
        }
        return data;
    }

    async getAll() {
        return await DiscountModel.find().sort({ createdAt: -1 });
    }

    async getById(id) {
        if (!mongoose.Types.ObjectId.isValid(id)) throw new ApplicationError("Discount not found", 404);
        const discount = await DiscountModel.findById(id);
        if (!discount) throw new ApplicationError("Discount not found", 404);
        return discount;
    }

    async create(body) {
        try {
            return await DiscountModel.create(this.clean(body));
        } catch (err) {
            throw this.friendlyError(err);
        }
    }

    async update(id, body) {
        const discount = await this.getById(id);
        // orders remember the code as text, so a used code must never change
        // (its usage counts and "once per customer" checks would stop matching)
        if (body.code !== undefined && String(body.code).trim().toUpperCase() !== discount.code && discount.used > 0) {
            throw new ApplicationError("This coupon has already been used, so its code can't be changed. Create a new coupon instead.", 400);
        }
        try {
            discount.set(this.clean(body, discount));
            return await discount.save();
        } catch (err) {
            throw this.friendlyError(err);
        }
    }

    async remove(id) {
        const discount = await this.getById(id);
        // a used coupon stays (its orders refer to it); switching it off stops new uses
        if (discount.used > 0) {
            throw new ApplicationError("This coupon has already been used, so it can't be deleted. Turn it off (Inactive) instead.", 400);
        }
        await discount.deleteOne();
        return discount;
    }

    // Turn Mongo / Mongoose errors into messages the admin can act on
    friendlyError(err) {
        if (err instanceof ApplicationError) return err;
        if (err?.code === 11000) return new ApplicationError("A discount with this code already exists", 409);
        if (err instanceof mongoose.Error.ValidationError) {
            const first = Object.values(err.errors)[0];
            return new ApplicationError(first?.message || "Invalid discount", 400);
        }
        console.log(err);
        return new ApplicationError("Something went wrong", 500);
    }

    // ---------- Checkout (shoppers) ----------

    // How many rupees a code takes off this subtotal (whole rupees, never more than the subtotal)
    static amountFor(discount, subTotal) {
        let amount = discount.type === "percentage"
            ? (subTotal * discount.value) / 100
            : discount.value;
        if (discount.type === "percentage" && discount.maxDiscount) amount = Math.min(amount, discount.maxDiscount);
        return Math.max(0, Math.min(Math.round(amount), subTotal));
    }

    // Checks a code for this shopper and cart. Returns { discount, amount } or throws a message
    // the shopper can understand. Used by "Apply" at checkout AND again when the order is placed.
    async validateForCheckout(rawCode, userId, subTotal) {
        const code = String(rawCode || "").trim().toUpperCase();
        if (!code) throw new ApplicationError("Enter a coupon code", 400);

        const discount = await DiscountModel.findOne({ code });
        const now = new Date();
        if (!discount || !discount.isActive) throw new ApplicationError("This coupon code isn't valid", 400);
        if (discount.startsAt && discount.startsAt > now) throw new ApplicationError("This coupon isn't active yet", 400);
        if (discount.endsAt && discount.endsAt < now) throw new ApplicationError("This coupon has expired", 400);
        if (discount.usageLimit != null && discount.used >= discount.usageLimit) {
            throw new ApplicationError("This coupon has been fully used", 400);
        }
        if (discount.minOrder && subTotal < discount.minOrder) {
            const short = Math.ceil(discount.minOrder - subTotal);
            throw new ApplicationError(`Add ₹${short.toLocaleString("en-IN")} more to use this coupon (minimum order ₹${discount.minOrder.toLocaleString("en-IN")})`, 400);
        }
        if (userId && discount.perCustomer) {
            const usedByMe = await OrderModel.countDocuments({
                user: userId,
                discountCode: code,
                // cancelled and returned orders give the use back
                status: { $nin: ["Cancelled", "Returned"] },
            });
            if (usedByMe >= discount.perCustomer) {
                throw new ApplicationError(
                    discount.perCustomer === 1 ? "You've already used this coupon" : `You can use this coupon ${discount.perCustomer} times, and you've used it all`,
                    400
                );
            }
        }

        const amount = DiscountRepository.amountFor(discount, subTotal);
        if (amount <= 0) throw new ApplicationError("This coupon doesn't take anything off this order", 400);
        return { discount, amount };
    }

    // Counts one use when an order is saved. The condition stops the last use being taken twice
    // by two orders at the same moment. Returns false if the coupon ran out meanwhile.
    async claimUse(code, amount) {
        const updated = await DiscountModel.findOneAndUpdate(
            {
                code,
                isActive: true,
                $or: [{ usageLimit: null }, { $expr: { $lt: ["$used", "$usageLimit"] } }],
            },
            { $inc: { used: 1, totalDiscountGiven: amount } },
            { new: true }
        );
        return Boolean(updated);
    }

    // Gives a use back (order failed after claiming, or the order was cancelled)
    async releaseUse(code, amount) {
        await DiscountModel.updateOne(
            { code, used: { $gt: 0 } },
            { $inc: { used: -1, totalDiscountGiven: -amount } }
        );
    }
}
