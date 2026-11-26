import { ObjectId } from "mongodb";
import { ApplicationError } from "../../error-handler/applicationError.js";
import mongoose from "mongoose";
import { productSchema } from "./product.schema.js";
import { CategoryModel } from "../category/category.schema.js";

const ProductModel = mongoose.model("Product", productSchema);

// "M,L" -> ["M","L"]
const toList = (value) => String(value ?? "").split(",").map((v) => v.trim()).filter(Boolean);

// so a search like "shirt (new)" is treated as plain text, not as a regex
const escapeRegex = (text) => String(text).replace(/[.*+?^$(){}|[\]\\]/g, "\\$&");

// The price the shopper pays: sellingPrice when it is saved, otherwise price minus discount.
const EFFECTIVE_PRICE = {
    $ifNull: [
        "$sellingPrice",
        { $round: [{ $multiply: ["$price", { $divide: [{ $subtract: [100, { $ifNull: ["$discount", 0] }] }, 100] }] }, 0] },
    ],
};

class ProductRepository{

    constructor(){
        this.collection = "products";
    }

    async add(productData){
        try{
            const newProduct = new ProductModel(productData);
            return await newProduct.save();
        }catch(err){
            console.log(err);
            throw new ApplicationError(err, 500);    
        }
    }

    // One place for every product list: shop page, search, category pages, new arrivals, deals.
    // Every filter is optional - it is only added to the query when it was sent.
    //   q            text search (name, brand, description)
    //   category     category slug(s), comma separated: "mens,womens"
    //   categoryId   category id(s), comma separated (used for "related products")
    //   size, color  comma separated lists: "M,L"
    //   minPrice, maxPrice   range on the price the shopper actually pays
    //   onSale       only discounted products
    //   exclude      a product id to leave out
    //   sort         popular | newest | price_asc | price_desc | rating
    //   page, limit  pagination
    async getAll({ q, category, categoryId, size, color, minPrice, maxPrice, onSale, includeInactive, exclude, sort, page = 1, limit = 12 } = {}){
        try{
            const empty = { items: [], total: 0, page: 1, pages: 1, limit };
            const match = includeInactive ? {} : { isActive: { $ne: false } };

            if(q){
                const rx = new RegExp(escapeRegex(q), "i");
                match.$or = [{ name: rx }, { brand: rx }, { description: rx }];
                // also find products by category name ("women" -> Womens). Matched from the start
                // of the name, so "men" finds Mens but not Womens. "all" is the whole shop, so skipped.
                const startsWith = new RegExp("^" + escapeRegex(q), "i");
                const searchCategories = await CategoryModel.find({
                    slug: { $ne: "all" },
                    isActive: { $ne: false },
                    $or: [{ categoryName: startsWith }, { slug: startsWith }],
                }).select("_id");
                if(searchCategories.length){
                    match.$or.push({ categories: { $in: searchCategories.map((c) => c._id) } });
                }
            }

            // Products store category ids, so slugs are looked up first. "all" means no category filter.
            const slugs = toList(category).map((s) => s.toLowerCase()).filter((s) => s !== "all");
            const categoryIds = toList(categoryId)
                .filter((id) => mongoose.isValidObjectId(id))
                .map((id) => new mongoose.Types.ObjectId(id));
            if(slugs.length){
                const found = await CategoryModel.find({ slug: { $in: slugs }, isActive: { $ne: false } }).select("_id");
                if(!found.length) return empty;
                categoryIds.push(...found.map((c) => c._id));
            }
            if(categoryIds.length) match.categories = { $in: categoryIds };

            const sizes = toList(size);
            if(sizes.length) match.sizes = { $in: sizes };

            // colours are free text in the admin panel, so match them ignoring case
            const colors = toList(color);
            if(colors.length) match.colors = { $in: colors.map((c) => new RegExp("^" + escapeRegex(c) + "$", "i")) };

            if(onSale) match.discount = { $gt: 0 };

            if(exclude && mongoose.isValidObjectId(exclude)){
                match._id = { $ne: new mongoose.Types.ObjectId(exclude) };
            }

            const priceMatch = {};
            if(minPrice != null) priceMatch.$gte = minPrice;
            if(maxPrice != null) priceMatch.$lte = maxPrice;

            // whitelist: only these sort keys are accepted from the URL
            const SORTS = {
                popular:    { "rating.count": -1, createdAt: -1, _id: -1 },
                newest:     { createdAt: -1, _id: -1 },
                price_asc:  { effectivePrice: 1, _id: 1 },
                price_desc: { effectivePrice: -1, _id: -1 },
                rating:     { "rating.average": -1, "rating.count": -1, _id: -1 },
            };

            const [result] = await ProductModel.aggregate([
                { $match: match },
                // older products have no sellingPrice, so work it out from price and discount
                { $addFields: { effectivePrice: EFFECTIVE_PRICE } },
                ...(Object.keys(priceMatch).length ? [{ $match: { effectivePrice: priceMatch } }] : []),
                { $facet: {
                    // one page of products
                    items: [
                        { $sort: SORTS[sort] || SORTS.popular },
                        { $skip: (page - 1) * limit },
                        { $limit: limit },
                    ],
                    // how many products match in total (for the page numbers)
                    meta: [{ $count: "total" }],
                } },
            ]);

            const total = result?.meta?.[0]?.total ?? 0;
            return {
                items: result?.items ?? [],
                total,
                page,
                pages: Math.max(1, Math.ceil(total / limit)),
                limit,
            };
        }catch(err){
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    // The sizes, colours and highest price that exist, so the shop only offers filters that can match.
    async getFilterOptions(){
        try{
            const active = { isActive: { $ne: false } };
            const [sizes, colors, priceRows] = await Promise.all([
                ProductModel.distinct("sizes", active),
                ProductModel.distinct("colors", active),
                ProductModel.aggregate([
                    { $match: active },
                    { $group: { _id: null, max: { $max: EFFECTIVE_PRICE } } },
                ]),
            ]);
            return {
                sizes: sizes.filter(Boolean),
                colors: colors.filter(Boolean),
                maxPrice: priceRows[0]?.max ?? 0,
            };
        }catch(err){
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    async get(id){
        try{
            return await ProductModel.findById(id)
        }catch(err){
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    // Changes only the fields that were sent. Returns the updated product, or null if the id doesn't exist.
    async update(id, data){
        try{
            return await ProductModel.findByIdAndUpdate(id, { $set: data }, { new: true, runValidators: true });
        }catch(err){
            console.log(err);
            throw new ApplicationError(err.message, 500);
        }
    }

    // Deletes the product and everything that points at it (bag items, wishlist items, reviews),
    // so no page is left holding a product that no longer exists. Past orders keep their own copy.
    async delete(id){
        try{
            const deleted = await ProductModel.findByIdAndDelete(id);
            if(!deleted) return null;
            const productId = deleted._id;
            await Promise.all([
                mongoose.model("Cart").deleteMany({ productID: productId }),
                mongoose.model("Wishlist").deleteMany({ productId }),
                mongoose.model("Review").deleteMany({ product: productId }),
            ]);
            return deleted;
        }catch(err){
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }
}

export default ProductRepository;