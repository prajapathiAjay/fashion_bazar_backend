import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/jwtSecret.js';
import UserRepository from '../features/user/user.repository.js';

const userRepository = new UserRepository();

const unauthorized = (res) => res.status(401).json({ success: false, message: 'Unauthorized' });

const jwtAuth = async (req, res, next) => {
  // 1. Read the token.
  // Header comes as "Bearer <token>"; also accept a raw token.
  const authHeader = req.headers['authorization'];
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : authHeader;

  // 2. if no token, return the error.
  if (!token) {
    return unauthorized(res);
  }

  // 3. check if token is valid (signature + not expired).
  let payload;
  try {
    payload = jwt.verify(token, getJwtSecret());
  } catch (err) {
    // expired or tampered with: normal, no need to print the whole error
    return unauthorized(res);
  }

  // 4. The user must still exist, and the token must be newer than their last password change.
  //    So deleting a user or changing the password logs out every old token straight away.
  try {
    const user = await userRepository.getAuthInfo(payload.userID);
    if (!user) {
      return unauthorized(res);
    }
    if (user.passwordChangedAt && payload.iat * 1000 < new Date(user.passwordChangedAt).getTime()) {
      return unauthorized(res);
    }
  } catch (err) {
    console.log(err);
    return res.status(500).json({ success: false, message: 'Something went wrong' });
  }

  req.userID = payload.userID;
  // 5. call next middleware
  next();
};

export default jwtAuth;
