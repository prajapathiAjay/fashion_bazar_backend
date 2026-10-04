import express from "express"
import CategoryController from "./category.controller.js";


const categoryController=new CategoryController()
const categoryRouter=express.Router();


categoryRouter.post("/",(req,res,next)=>{categoryController.createCategory(req,res,next)})
categoryRouter.get("/",(req,res,next)=>{
    categoryController.getAllCategory(req,res,next)

})
categoryRouter.get("/:id",(req,res,next)=>{
    categoryController.getCategoryById(req,res,next)
})

categoryRouter.patch("/:id",(req,res,next)=>{
    categoryController.updateCategory(req,res,next)
})

categoryRouter.delete("/:id",(req,res,next)=>{
    categoryController.deleteCategory(req,res,next)
})







export default categoryRouter