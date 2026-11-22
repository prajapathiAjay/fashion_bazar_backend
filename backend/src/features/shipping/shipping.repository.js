import { ShippingSettingsModel, SHIPPING_METHODS } from "./shipping.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

export default class ShippingRepository {

    // Returns the settings, creating them with the old fixed values (₹99 / free over ₹999 / ₹199) the first time
    async get() {
        return await ShippingSettingsModel.findOneAndUpdate(
            { key: "default" },
            { $setOnInsert: { key: "default" } },
            { upsert: true, new: true, setDefaultsOnInsert: true }
        );
    }

    // body = { standard?: {...}, express?: {...} }, any fields of each method
    async update(body = {}) {
        const settings = await this.get();

        for (const method of SHIPPING_METHODS) {
            const incoming = body[method];
            if (!incoming || typeof incoming !== "object") continue;

            const current = settings[method].toObject();
            const next = { ...current };
            for (const field of ["enabled", "price", "freeAbove", "minDays", "maxDays"]) {
                if (field in incoming) next[field] = incoming[field];
            }

            // empty "free above" box = never free
            if (next.freeAbove === "" || next.freeAbove === undefined) next.freeAbove = null;
            next.enabled = Boolean(next.enabled);
            for (const field of ["price", "minDays", "maxDays"]) {
                next[field] = Number(next[field]);
                if (!Number.isFinite(next[field]) || next[field] < 0) {
                    throw new ApplicationError(`${method}: ${field} must be 0 or more`, 400);
                }
            }
            if (next.freeAbove !== null) {
                next.freeAbove = Number(next.freeAbove);
                if (!Number.isFinite(next.freeAbove) || next.freeAbove < 0) {
                    throw new ApplicationError(`${method}: free above must be 0 or more`, 400);
                }
            }
            if (next.minDays > next.maxDays) {
                throw new ApplicationError(`${method}: minimum days can't be more than maximum days`, 400);
            }
            settings[method] = next;
        }

        if (!settings.standard.enabled && !settings.express.enabled) {
            throw new ApplicationError("At least one delivery method must stay on", 400);
        }
        return await settings.save();
    }
}
