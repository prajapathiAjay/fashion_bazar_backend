import express from "express"
import CategoryController from "./category.controller.js";
import jwtAuth from "../../middlewares/jwt.middleware.js";
import { isAdmin } from "../../middlewares/IsAdmin.js";

// Reading categories is public (the shop). Creating, editing and deleting need an admin login.


const categoryController=new CategoryController()
const categoryRouter=express.Router();


categoryRouter.post("/",jwtAuth,isAdmin,(req,res,next)=>{categoryController.createCategory(req,res,next)})
categoryRouter.get("/",(req,res,next)=>{
    categoryController.getAllCategory(req,res,next)

})
categoryRouter.get("/:id",(req,res,next)=>{
    categoryController.getCategoryById(req,res,next)
})

categoryRouter.patch("/:id",jwtAuth,isAdmin,(req,res,next)=>{
    categoryController.updateCategory(req,res,next)
})

categoryRouter.delete("/:id",jwtAuth,isAdmin,(req,res,next)=>{
    categoryController.deleteCategory(req,res,next)
})







export default categoryRouter