import mongoose from "mongoose";
import { ShippingMethodModel } from "./shipping.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

const EDITABLE = ["name", "description", "price", "freeAbove", "minDays", "maxDays", "enabled", "sortOrder"];

// "Same Day Delivery!" -> "same-day-delivery"
const slugify = (text) =>
    String(text || "").toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 30);

// The first time, start with the two methods the shop always had.
// If the earlier single "shipping settings" document exists, its prices are used.
const seedMethods = async () => {
    let old = null;
    try {
        old = await mongoose.connection.db.collection("shippingsettings").findOne({ key: "default" });
    } catch { /* no old settings */ }
    const standard = old?.standard ?? { enabled: true, price: 99, freeAbove: 999, minDays: 4, maxDays: 6 };
    const express = old?.express ?? { enabled: true, price: 199, freeAbove: null, minDays: 1, maxDays: 2 };
    try {
        await ShippingMethodModel.insertMany([
            { code: "standard", name: "Standard", description: "Everyday delivery", sortOrder: 1, ...pick(standard) },
            { code: "express", name: "Express", description: "Fastest delivery", sortOrder: 2, ...pick(express) },
        ], { ordered: false });
    } catch (err) {
        if (err?.code !== 11000) throw err;   // another request seeded at the same moment
    }
};
const pick = (m) => ({ enabled: m.enabled, price: m.price, freeAbove: m.freeAbove ?? null, minDays: m.minDays, maxDays: m.maxDays });

export default class ShippingRepository {

    async ensureSeeded() {
        if ((await ShippingMethodModel.estimatedDocumentCount()) === 0) await seedMethods();
    }

    // All methods (admin) or only the ones shoppers can pick (checkout), in display order
    async list({ onlyEnabled = false } = {}) {
        await this.ensureSeeded();
        return await ShippingMethodModel.find(onlyEnabled ? { enabled: true } : {}).sort({ sortOrder: 1, createdAt: 1 });
    }

    async getById(id) {
        if (!mongoose.Types.ObjectId.isValid(id)) throw new ApplicationError("Shipping method not found", 404);
        const method = await ShippingMethodModel.findById(id);
        if (!method) throw new ApplicationError("Shipping method not found", 404);
        return method;
    }

    // Used by checkout: the chosen method, or the first enabled one if none was sent
    async getForCheckout(code) {
        const methods = await this.list({ onlyEnabled: true });
        if (methods.length === 0) throw new ApplicationError("Delivery is not available right now", 400);
        if (!code) return methods[0];
        const method = methods.find((m) => m.code === code);
        if (!method) throw new ApplicationError("This delivery option is not available any more, please pick another", 400);
        return method;
    }

    // Keep allowed fields, turn numbers into numbers, check the rules
    clean(body = {}, existing = null) {
        const data = {};
        for (const key of EDITABLE) if (key in body) data[key] = body[key];

        if ("freeAbove" in data && (data.freeAbove === "" || data.freeAbove === undefined)) data.freeAbove = null;
        for (const key of ["price", "freeAbove", "minDays", "maxDays", "sortOrder"]) {
            if (key in data && data[key] !== null) {
                data[key] = Number(data[key]);
                if (!Number.isFinite(data[key]) || data[key] < 0) {
                    throw new ApplicationError(`${key} must be 0 or more`, 400);
                }
            }
        }
        if ("enabled" in data) data.enabled = Boolean(data.enabled);
        if ("name" in data) data.name = String(data.name).trim();

        const final = { ...(existing?.toObject?.() ?? {}), ...data };
        if (!final.name) throw new ApplicationError("Name is required", 400);
        if (final.minDays > final.maxDays) {
            throw new ApplicationError("Minimum days can't be more than maximum days", 400);
        }
        return data;
    }

    async create(body) {
        await this.ensureSeeded();
        const data = this.clean(body);
        for (const key of ["price", "minDays", "maxDays"]) {
            if (data[key] === undefined || data[key] === null) throw new ApplicationError(`${key} is required`, 400);
        }

        // code from the name; add -2, -3... if it's taken
        const base = slugify(data.name) || "method";
        let code = base;
        for (let n = 2; await ShippingMethodModel.exists({ code }); n++) code = `${base}-${n}`.slice(0, 30);

        // new methods go to the end of the list unless a position was given
        if (data.sortOrder === undefined) {
            const last = await ShippingMethodModel.findOne().sort({ sortOrder: -1 });
            data.sortOrder = (last?.sortOrder ?? 0) + 1;
        }
        try {
            return await ShippingMethodModel.create({ ...data, code });
        } catch (err) {
            throw this.friendlyError(err);
        }
    }

    async update(id, body) {
        const method = await this.getById(id);
        const data = this.clean(body, method);
        if (data.enabled === false && method.enabled) await this.assertAnotherEnabled(method._id);
        method.set(data);
        try {
            return await method.save();
        } catch (err) {
            throw this.friendlyError(err);
        }
    }

    async remove(id) {
        const method = await this.getById(id);
        if (method.enabled) await this.assertAnotherEnabled(method._id);
        await method.deleteOne();   // old orders keep the name they were saved with
        return method;
    }

    // Shoppers must always have at least one option
    async assertAnotherEnabled(exceptId) {
        const others = await ShippingMethodModel.countDocuments({ enabled: true, _id: { $ne: exceptId } });
        if (others === 0) throw new ApplicationError("At least one delivery method must stay on", 400);
    }

    friendlyError(err) {
        if (err instanceof ApplicationError) return err;
        if (err?.code === 11000) return new ApplicationError("A method with this code already exists", 409);
        if (err instanceof mongoose.Error.ValidationError) {
            return new ApplicationError(Object.values(err.errors)[0]?.message || "Invalid shipping method", 400);
        }
        console.log(err);
        return new ApplicationError("Something went wrong", 500);
    }
}
