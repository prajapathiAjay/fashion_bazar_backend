import mongoose from "mongoose";
import { DiscountModel } from "./discount.schema.js";
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
        return new Date(`${value}T${endOfDay ? "23:59:59.999" : "00:00:00"}`);
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
        try {
            discount.set(this.clean(body, discount));
            return await discount.save();
        } catch (err) {
            throw this.friendlyError(err);
        }
    }

    async remove(id) {
        const discount = await this.getById(id);
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
}
