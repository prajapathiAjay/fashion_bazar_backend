import UserRepository from "../features/user/user.repository.js";
import { ApplicationError } from "../error-handler/applicationError.js";

const userRepo = new UserRepository();

export const isAdmin = async (req, res, next) => {
    try {
        const user = await userRepo.getUserById(req.userID);
        if (!user) {
            return next(new ApplicationError("User not found", 401));
        }
        if (user.type !== "admin") {
            return next(new ApplicationError("Admin access only", 403));
        }
        next();
    } catch (error) {
        next(error);
    }
};
