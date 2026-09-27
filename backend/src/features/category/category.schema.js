import mongoose from "mongoose"



 const categorySchema=new mongoose.Schema({

    categoryName:{
        type:String,
        required:true,

    },
    description:{
        type:String,
        required:true
    },
    image:{
        type:String,
        trim:true
    },
    isActive:{
        type:Boolean,
        trim:true,
        default:true
    },
//       slug: {
//     type: String,
//     required: true,
//     unique: true,
//     trim: true,
//   },










})

export const CategoryModel=mongoose.model("Category",categorySchema)