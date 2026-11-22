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

    // Returns the user only if they are an admin, otherwise null
    async findAdminByEmail(email) {
        try {
            return await UserModel.findOne({ email, type: "admin" });
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
                throw new ApplicationError("user not found", 500);
            }

            Object.assign(user, data)
            await user.save()

            return user

        } catch (err) {
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

    // ---------- Admin (view only) ----------

    // Every shopper (not admins), newest first, with how many orders they placed
    // and how much they spent (cancelled orders don't count as spent).
    async getAllCustomers() {
        return await UserModel.aggregate([
            { $match: { type: { $ne: "admin" } } },
            {
                $lookup: {
                    from: "orders",
                    localField: "_id",
                    foreignField: "user",
                    as: "orders",
                    pipeline: [{ $project: { totalAmount: 1, status: 1, createdAt: 1 } }],
                },
            },
            {
                $project: {
                    firstName: 1, lastName: 1, email: 1, phone: 1, createdAt: 1,
                    orderCount: { $size: "$orders" },
                    totalSpent: {
                        $sum: {
                            $map: {
                                input: { $filter: { input: "$orders", cond: { $ne: ["$$this.status", "Cancelled"] } } },
                                in: "$$this.totalAmount",
                            },
                        },
                    },
                    lastOrderAt: { $max: "$orders.createdAt" },
                },
            },
            { $sort: { createdAt: -1 } },
        ]);
    }

    // One shopper with their saved addresses and all their orders (newest first)
    async getCustomerById(customerId) {
        if (!mongoose.Types.ObjectId.isValid(customerId)) {
            throw new ApplicationError("Customer not found", 404);
        }
        const customer = await UserModel.findOne({ _id: customerId, type: { $ne: "admin" } })
            .select("-password")
            .lean();
        if (!customer) throw new ApplicationError("Customer not found", 404);

        const orders = await mongoose.connection.db.collection("orders")
            .find({ user: customer._id })
            .project({ orderNumber: 1, totalAmount: 1, status: 1, paymentStatus: 1, paymentMethod: 1, items: 1, createdAt: 1 })
            .sort({ createdAt: -1 })
            .toArray();

        return { ...customer, orders };
    }
}