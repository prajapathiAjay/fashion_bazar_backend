import mongoose from "mongoose"



 const categorySchema=new mongoose.Schema({

    categoryName:{
        type:String,
        required:true,
        unique:true,
        trim:true
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
        default:true
    },
    slug: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },



}, { timestamps: true })

// to add slug before saving the category
categorySchema.pre("validate",function(){
if(this.categoryName && !this.slug){
    this.slug=this.categoryName
        .toLowerCase()
        .trim()
        .replace(/\s+/g,"-")
        .replace(/[^\w-]+/g,"")
        .replace(/-+/g,"-")
        .replace(/^-|-$/g,"")
}



})

export const CategoryModel=mongoose.model("Category",categorySchema)