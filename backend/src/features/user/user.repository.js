import mongoose from "mongoose";
import { userSchema } from "./user.schema.js";
import { ApplicationError } from "../../error-handler/applicationError.js";

// creating model from schema.
const UserModel = mongoose.model('User', userSchema)

export default class UserRepository {

    async resetPassword(userID, hashedPassword) {
        try {
            let user = await UserModel.findById(userID);
            if (user) {
                user.password = hashedPassword;
                user.save();
            } else {
                throw new Error("No such user found");
            }

        } catch (err) {
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    async signUp(user) {
        try {
            // create instance of model.
            const newUser = new UserModel(user);
            await newUser.save();
            return newUser;
        }
        catch (err) {
            console.log(err);
            if (err instanceof mongoose.Error.ValidationError) {
                throw err;
            } else {
                console.log(err);
                throw new ApplicationError(err, 500);
            }

        }
    }

    async signIn(email, password) {
        try {
            return await UserModel.findOne({ email, password });
        }
        catch (err) {
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }

    async findByEmail(email) {
        try {
            return await UserModel.findOne({ email });
        } catch (err) {
            console.log(err);
            throw new ApplicationError("Something went wrong with database", 500);
        }
    }


    async updateUser(userID, data) {
        try {
            const user = await UserModel.findById(userID)
            console.log("getting error",user)
            if (!user) {
                throw new Error("No such user found");
            }

            Object.assign(user, data)
            await user.save()

            return user

        } catch (error) {
             if (err instanceof mongoose.Error.ValidationError) {
                throw err;
            } else {
                console.log(err);
                throw new ApplicationError("Something get wrong", 500);
            }
        }

    }


    async getUserById(userID) {
        try {
            const user = await UserModel.findById(userID)
            //  .select("-password")
            return user;
        } catch (err) {

            throw new ApplicationError(err, 500);
        }
    }
}