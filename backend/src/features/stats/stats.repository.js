import mongoose from "mongoose";
import { OrderModel } from "../order/order.schema.js";
import { productSchema } from "../product/product.schema.js";
import { userSchema } from "../user/user.schema.js";
import { CategoryModel } from "../category/category.schema.js";
import { ReviewModel } from "../review/review.schema.js";

// Reuse the models other features already registered (registering twice throws)
const ProductModel = mongoose.models.Product || mongoose.model("Product", productSchema);
const UserModel = mongoose.models.User || mongoose.model("User", userSchema);

// Admin Dashboard + Analytics numbers, worked out from the real orders / products / users.
// Everything is grouped by Indian time (IST), whatever timezone the server runs in.

export const RANGES = ["7d", "30d", "12m"];
const DAY = 24 * 60 * 60 * 1000;
const IST_OFFSET = 330 * 60 * 1000; // UTC+5:30
const LOW_STOCK_AT = 10; // products with this many or fewer left show in "Low stock"
const ORDER_STATUSES = ["Ordered", "Packed", "Shipped", "Delivered", "Cancelled"];

// a Date shifted to IST, read it with getUTC*() to get Indian date/time parts
const ist = (date) => new Date(new Date(date).getTime() + IST_OFFSET);
const istLabel = (time, options) =>
    new Date(time).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", ...options });

const round1 = (n) => Math.round(n * 10) / 10;
// % change from the previous period; null when there is nothing to compare with
const change = (current, previous) => (previous ? round1(((current - previous) / previous) * 100) : null);
const isCounted = (order) => order.status !== "Cancelled"; // cancelled orders don't count as sales

/**
 * The time slots for a range: the current period and the same length just before it.
 *   7d / 30d -> one slot per day, 12m -> one slot per month.
 * edges[i]..edges[i+1] is slot i (times in ms). prevEdges is the previous period.
 */
function buildPeriods(range, now = new Date()) {
    const t = ist(now);
    const y = t.getUTCFullYear();
    const m = t.getUTCMonth();
    const d = t.getUTCDate();

    if (range === "12m") {
        // IST midnight on the 1st of a month (months may be negative / > 11, Date.UTC handles it)
        const monthStart = (offset) => Date.UTC(y, m + offset, 1) - IST_OFFSET;
        const edges = Array.from({ length: 13 }, (_, i) => monthStart(i - 11));
        const prevEdges = Array.from({ length: 13 }, (_, i) => monthStart(i - 23));
        const labels = edges.slice(0, 12).map((e) => istLabel(e, { month: "short" }));
        return { edges, prevEdges, labels };
    }

    const days = range === "7d" ? 7 : 30;
    const todayStart = Date.UTC(y, m, d) - IST_OFFSET;
    const start = todayStart - (days - 1) * DAY;
    const edges = Array.from({ length: days + 1 }, (_, i) => start + i * DAY);
    const prevEdges = Array.from({ length: days + 1 }, (_, i) => start - days * DAY + i * DAY);
    const labels = edges
        .slice(0, days)
        .map((e) => istLabel(e, range === "7d" ? { weekday: "short" } : { day: "numeric", month: "short" }));
    return { edges, prevEdges, labels };
}

// which slot a time falls in (-1 if outside)
const slotOf = (time, edges) => {
    const t = new Date(time).getTime();
    if (t < edges[0] || t >= edges[edges.length - 1]) return -1;
    let i = 0;
    while (t >= edges[i + 1]) i++;
    return i;
};

// orders split into this period's slots and the previous period's slots
function splitBySlot(items, periods, getTime = (x) => x.createdAt) {
    const n = periods.edges.length - 1;
    const current = Array.from({ length: n }, () => []);
    const previous = Array.from({ length: n }, () => []);
    for (const item of items) {
        const t = getTime(item);
        const c = slotOf(t, periods.edges);
        if (c >= 0) current[c].push(item);
        else {
            const p = slotOf(t, periods.prevEdges);
            if (p >= 0) previous[p].push(item);
        }
    }
    return { current, previous };
}

// one KPI card: total for the period, % change and a sparkline (one value per slot)
function kpi(key, label, format, currentSlots, previousSlots, measure, extra = {}) {
    const value = measure(currentSlots.flat());
    const prevValue = measure(previousSlots.flat());
    return {
        key,
        label,
        format,
        value,
        change: change(value, prevValue),
        spark: currentSlots.map((slot) => measure(slot)),
        ...extra,
    };
}

const revenueOf = (orders) => orders.filter(isCounted).reduce((sum, o) => sum + (o.totalAmount || 0), 0);
const countOf = (orders) => orders.filter(isCounted).length;
const aovOf = (orders) => {
    const n = countOf(orders);
    return n ? Math.round(revenueOf(orders) / n) : 0;
};
const unitsOf = (order) => (order.items || []).reduce((sum, item) => sum + (item.quantity || 0), 0);

const customerName = (user) =>
    [user?.firstName, user?.lastName].filter(Boolean).join(" ") || user?.email || "Customer";

export default class StatsRepository {

    // product id -> { name, category name, stock, rating, image }
    async productLookup() {
        const [products, categories] = await Promise.all([
            ProductModel.find().select("name categories stock images rating isActive").lean(),
            CategoryModel.find().select("categoryName").lean(),
        ]);
        const categoryName = new Map(categories.map((c) => [String(c._id), c.categoryName]));
        const byId = new Map(
            products.map((p) => [
                String(p._id),
                {
                    id: String(p._id),
                    name: p.name,
                    category: categoryName.get(String(p.categories?.[0])) || "Uncategorised",
                    stock: p.stock ?? 0,
                    rating: p.rating?.average ?? 0,
                    ratingCount: p.rating?.count ?? 0,
                    image: p.images?.[0] || null,
                    isActive: p.isActive !== false,
                },
            ])
        );
        return { products, byId };
    }

    // sales per product over a list of orders, best sellers first
    productSales(orders, byId) {
        const rows = new Map();
        for (const order of orders.filter(isCounted)) {
            for (const item of order.items || []) {
                const id = String(item.product);
                const info = byId.get(id);
                const row = rows.get(id) || {
                    id,
                    name: info?.name || item.name, // product may have been deleted since
                    category: info?.category || "Uncategorised",
                    image: info?.image || item.image || null,
                    rating: info?.rating ?? 0,
                    ratingCount: info?.ratingCount ?? 0,
                    stock: info?.stock ?? null,
                    sold: 0,
                    revenue: 0,
                    orderIds: new Set(),
                };
                row.sold += item.quantity || 0;
                row.revenue += (item.price || 0) * (item.quantity || 0);
                row.orderIds.add(String(order._id));
                rows.set(id, row);
            }
        }
        return [...rows.values()]
            .map(({ orderIds, ...row }) => ({ ...row, orders: orderIds.size }))
            .sort((a, b) => b.revenue - a.revenue);
    }

    async dashboard(range) {
        const periods = buildPeriods(range);
        const since = new Date(periods.prevEdges[0]);

        const [orders, signups, recentOrders, recentReviews, recentSignups, { products, byId }] = await Promise.all([
            OrderModel.find({ createdAt: { $gte: since } })
                .select("items status totalAmount createdAt")
                .lean(),
            UserModel.find({ type: { $ne: "admin" }, createdAt: { $gte: since } }).select("createdAt").lean(),
            OrderModel.find()
                .sort({ createdAt: -1 })
                .limit(6)
                .populate("user", "firstName lastName email")
                .select("orderNumber user items status totalAmount createdAt")
                .lean(),
            ReviewModel.find().sort({ createdAt: -1 }).limit(4).populate("product", "name").select("rating product createdAt").lean(),
            UserModel.find({ type: { $ne: "admin" } }).sort({ createdAt: -1 }).limit(4).select("firstName lastName email createdAt").lean(),
            this.productLookup(),
        ]);

        const { current, previous } = splitBySlot(orders, periods);
        const users = splitBySlot(signups, periods);
        const currentOrders = current.flat();

        const kpis = [
            kpi("revenue", "Total Revenue", "currency", current, previous, revenueOf),
            kpi("orders", "Orders", "number", current, previous, countOf),
            kpi("customers", "New Customers", "number", users.current, users.previous, (list) => list.length),
            kpi("aov", "Avg. Order Value", "currency", current, previous, aovOf),
        ];

        // revenue per category (a product counts under its first category)
        const categoryTotals = new Map();
        for (const order of currentOrders.filter(isCounted)) {
            for (const item of order.items || []) {
                const name = byId.get(String(item.product))?.category || "Uncategorised";
                categoryTotals.set(name, (categoryTotals.get(name) || 0) + (item.price || 0) * (item.quantity || 0));
            }
        }
        const categorySales = [...categoryTotals]
            .map(([name, revenue]) => ({ name, revenue }))
            .sort((a, b) => b.revenue - a.revenue)
            .slice(0, 6);

        const orderStatus = ORDER_STATUSES.map((status) => ({
            status,
            count: currentOrders.filter((o) => o.status === status).length,
        }));

        const lowStockAll = products
            .filter((p) => p.isActive !== false && (p.stock ?? 0) <= LOW_STOCK_AT)
            .sort((a, b) => (a.stock ?? 0) - (b.stock ?? 0));
        const lowStock = lowStockAll.slice(0, 6).map((p) => ({ ...byId.get(String(p._id)), threshold: LOW_STOCK_AT }));

        // latest things that happened, newest first
        const activity = [
            ...recentOrders.map((o) => ({
                type: "order",
                text: `New order ${o.orderNumber} placed by ${customerName(o.user)}`,
                at: o.createdAt,
            })),
            ...recentReviews.map((r) => ({
                type: "review",
                text: `${r.rating}★ review on ${r.product?.name || "a product"}`,
                at: r.createdAt,
            })),
            ...recentSignups.map((u) => ({
                type: "customer",
                text: `${customerName(u)} created an account`,
                at: u.createdAt,
            })),
        ]
            .sort((a, b) => new Date(b.at) - new Date(a.at))
            .slice(0, 6);

        return {
            range,
            kpis,
            revenue: {
                labels: periods.labels,
                current: current.map(revenueOf),
                previous: previous.map(revenueOf),
            },
            categorySales,
            orderStatus,
            recentOrders: recentOrders.map((o) => ({
                id: String(o._id),
                orderNumber: o.orderNumber,
                customer: customerName(o.user),
                email: o.user?.email || "",
                items: unitsOf(o),
                total: o.totalAmount,
                status: o.status,
                createdAt: o.createdAt,
            })),
            topProducts: this.productSales(currentOrders, byId).slice(0, 5),
            lowStock,
            lowStockCount: lowStockAll.length,
            activity,
        };
    }

    async analytics(range) {
        const periods = buildPeriods(range);
        const since = new Date(periods.prevEdges[0]);

        // last 6 months (including this one) for the new-vs-returning chart
        const t = ist(new Date());
        const mixEdges = Array.from(
            { length: 7 },
            (_, i) => Date.UTC(t.getUTCFullYear(), t.getUTCMonth() - 5 + i, 1) - IST_OFFSET
        );
        const earliest = new Date(Math.min(periods.prevEdges[0], mixEdges[0]));

        const [orders, firstOrders, { byId }] = await Promise.all([
            OrderModel.find({ createdAt: { $gte: earliest } })
                .select("user items status totalAmount createdAt shippingAddress.state")
                .lean(),
            // each customer's first (non-cancelled) order ever
            OrderModel.aggregate([
                { $match: { status: { $ne: "Cancelled" } } },
                { $group: { _id: "$user", first: { $min: "$createdAt" } } },
            ]),
            this.productLookup(),
        ]);

        const firstOrderAt = new Map(firstOrders.map((f) => [String(f._id), new Date(f.first).getTime()]));
        // an order is from a returning customer if they had ordered before it
        const isRepeat = (o) => new Date(o.createdAt).getTime() > (firstOrderAt.get(String(o.user)) ?? Infinity);

        const inRange = orders.filter((o) => new Date(o.createdAt).getTime() >= since.getTime());
        const { current, previous } = splitBySlot(inRange, periods);
        const currentOrders = current.flat();

        const buyersOf = (list) => new Set(list.filter(isCounted).map((o) => String(o.user)));
        const kpis = [
            kpi("buyers", "Customers Who Ordered", "number", current, previous, (list) => buyersOf(list).size),
            kpi("returning", "Returning Customers", "percent", current, previous, (list) => {
                const buyers = buyersOf(list);
                if (!buyers.size) return 0;
                const repeat = new Set(list.filter((o) => isCounted(o) && isRepeat(o)).map((o) => String(o.user)));
                return round1((repeat.size / buyers.size) * 100);
            }),
            kpi("cancelled", "Cancellation Rate", "percent", current, previous, (list) =>
                list.length ? round1((list.filter((o) => !isCounted(o)).length / list.length) * 100) : 0,
                { invert: true }
            ),
            kpi("items", "Items per Order", "decimal", current, previous, (list) => {
                const counted = list.filter(isCounted);
                return counted.length ? round1(counted.reduce((s, o) => s + unitsOf(o), 0) / counted.length) : 0;
            }),
        ];

        // orders by weekday x 3-hour slot (IST), Monday first
        const heatmap = {
            days: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
            slots: ["12a", "3a", "6a", "9a", "12p", "3p", "6p", "9p"],
            values: Array.from({ length: 7 }, () => Array(8).fill(0)),
        };
        for (const o of currentOrders.filter(isCounted)) {
            const when = ist(o.createdAt);
            heatmap.values[(when.getUTCDay() + 6) % 7][Math.floor(when.getUTCHours() / 3)]++;
        }

        // revenue by delivery state
        const states = new Map();
        for (const o of currentOrders.filter(isCounted)) {
            const state = o.shippingAddress?.state?.trim() || "Not given";
            const row = states.get(state) || { state, orders: 0, revenue: 0 };
            row.orders++;
            row.revenue += o.totalAmount || 0;
            states.set(state, row);
        }
        const regions = [...states.values()].sort((a, b) => b.revenue - a.revenue).slice(0, 7);

        // customers who ordered each month: first order that month = new, otherwise returning
        const mix = { months: [], fullMonths: [], new: [], returning: [] };
        for (let i = 0; i < 6; i++) {
            const monthOrders = orders.filter((o) => {
                const at = new Date(o.createdAt).getTime();
                return isCounted(o) && at >= mixEdges[i] && at < mixEdges[i + 1];
            });
            const buyers = new Set(monthOrders.map((o) => String(o.user)));
            let fresh = 0;
            for (const user of buyers) {
                const first = firstOrderAt.get(user);
                if (first >= mixEdges[i] && first < mixEdges[i + 1]) fresh++;
            }
            mix.months.push(istLabel(mixEdges[i], { month: "short" }));
            mix.fullMonths.push(istLabel(mixEdges[i], { month: "long", year: "numeric" }));
            mix.new.push(fresh);
            mix.returning.push(buyers.size - fresh);
        }

        return {
            range,
            kpis,
            heatmap,
            regions,
            customerMix: mix,
            productPerformance: this.productSales(currentOrders, byId).slice(0, 8),
        };
    }
}
