import mongoose from "mongoose";
import { CategoryModel } from "./category.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";
import { productSchema } from "../product/product.schema.js";

// Reuse the model if the product repository already registered it
const ProductModel = mongoose.models.Product || mongoose.model("Product", productSchema);

// Only these fields can be set from the admin panel (slug is made once, on create, so links never break)
const EDITABLE = ["categoryName", "description", "image", "isActive"];
const pick = (body = {}) => {
    const data = {};
    for (const key of EDITABLE) if (body[key] !== undefined) data[key] = body[key];
    return data;
};

// Database errors in words the admin understands
const friendly = (error) => {
    if (error instanceof ApplicationError) return error;
    if (error?.code === 11000) return new ApplicationError("A category with this name already exists", 400);
    if (error instanceof mongoose.Error.ValidationError) {
        return new ApplicationError(Object.values(error.errors)[0]?.message || "Please check the category details", 400);
    }
    console.log(error);
    return new ApplicationError("Something went wrong with the database", 500);
};

export default class CategoryRepository {

    async createCategory(body) {
        try {
            return await new CategoryModel(pick(body)).save();
        } catch (error) {
            throw friendly(error);
        }
    }

    // Shop: only active categories. Admin panel passes includeInactive to see the hidden ones too.
    async getAllCategory(includeInactive = false) {
        try {
            return await CategoryModel.find(includeInactive ? {} : { isActive: { $ne: false } });
        } catch (error) {
            throw friendly(error);
        }
    }

    async getCategoryById(id) {
        try {
            return await CategoryModel.findById(id);
        } catch (error) {
            throw friendly(error);
        }
    }

    async updateCategory(id, body) {
        try {
            return await CategoryModel.findByIdAndUpdate(id, pick(body), { new: true, runValidators: true });
        } catch (error) {
            throw friendly(error);
        }
    }

    // A category that products still use can't be deleted (they'd point at nothing);
    // "All" is the whole shop, so it stays.
    async deleteCategory(id) {
        try {
            const category = await CategoryModel.findById(id);
            if (!category) return null;
            if (category.slug === "all") throw new ApplicationError("The \"All\" category can't be deleted", 400);
            const inUse = await ProductModel.countDocuments({ categories: category._id });
            if (inUse) {
                throw new ApplicationError(
                    `${inUse} ${inUse === 1 ? "product uses" : "products use"} this category. Move ${inUse === 1 ? "it" : "them"} to another category first, or set this one to Inactive.`,
                    400
                );
            }
            await category.deleteOne();
            return category;
        } catch (error) {
            throw friendly(error);
        }
    }
}
