
import { CategoryModel } from "./category.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

export default class CategoryRepository {


    async createCategory(data) {

        try {
            const newCategory = new CategoryModel(data)
            const savedCategory = await newCategory.save();
            return savedCategory
        } catch (error) {
            console.log(error)
            throw new ApplicationError(error, 500)
        }

    }


  async getAllCategory(){



  try {
      const response=await CategoryModel.find()
        return response
  } catch (error) {
      throw new ApplicationError(error, 500)
  }



  }


  async getCategoryById(id) {
    try {
      const category = await CategoryModel.findById(id)
      return category
    } catch (error) {
      throw new ApplicationError(error, 500)
    }
  }

  async updateCategory(id, data) {
    try {
      const updatedCategory = await CategoryModel.findByIdAndUpdate(id, data, { new: true })
      return updatedCategory
    } catch (error) {
      throw new ApplicationError(error, 500)
    }
  }

  async deleteCategory(id) {
    try {
      const deletedCategory = await CategoryModel.findByIdAndDelete(id)
      return deletedCategory
    } catch (error) {
      throw new ApplicationError(error, 500)
    }
  }



}