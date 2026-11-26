
import mongoose from "mongoose";

export const productSchema = new mongoose.Schema(
  {
    // Basic information
    name: {
      type: String,
      required: true,
      trim: true,
    },

    // slug: {
    //   type: String,
    //   required: true,
    //   unique: true,
    //   trim: true,
    // },
    
   sellingPrice: {
      type: Number,
      required: true,
      min: 0,
    },
    description: {
      type: String,
      required :true,
      trim: true,
    },

    summary:{
        type:String,
        required:true,
        trim:true,
    },

    brand: {
      type: String,
      trim: true,
    },

    // Pricing
    price: {
      type: Number,
      required: true,
      min: 0,
    },

    discount: {
      type: Number,
      default: 0,
      min: 0,
      max: 100,
    },

    // Inventory
    stock: {
      type: Number,
      default: 0,
      min: 0,
    },

    // sku: {
    //   type: String,
    //   unique: true,
    //   sparse: true,
    //   trim: true,
    // },

    // Images
    images: [String],

    // Product rating
    rating: {
      average: {
        type: Number,
        default: 0,
        min: 0,
        max: 5,
      },

      count: {
        type: Number,
        default: 0,
      },
    },

    // Product status
    isActive: {
      type: Boolean,
      default: true,
    },

    // Relations
    reviews: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Review",
      },
    ],

    categories: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Category",
      },
    ],

    // Fashion-specific information
    // same list the bag accepts (cart schema), so every size can actually be bought
    sizes: [{ type: String, enum: { values: ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'], message: 'Size {VALUE} is not allowed. Use XXS, XS, S, M, L, XL, XXL or 3XL.' } }],

    colors: [String],
  },
  {
    timestamps: true,
  }
);