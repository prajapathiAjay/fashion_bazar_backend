
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



}