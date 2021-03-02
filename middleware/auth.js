const ErrorResponse = require('../utils/errorResponse');
const HASH = require('../utils/token');
const status = require('../utils/status');
const admin = require('firebase-admin');
const firstore = admin.firestore();

exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    return next(new ErrorResponse(status.UNAUTHORIZED, 401));
  }

  try {
    // Verify token
    const decoded = await HASH.verifyToken(token);
    if (!decoded) {
      return next(new ErrorResponse(status.UNAUTHORIZED, 401));
    } else {
      let user = await firstore.collection('admin').doc(decoded.user_id).get()
      if (user.exists) {
        req.user = user.data();
        req.user.id = user.id;
        if (decoded.business_id) {
          req.user.business_id = decoded.business_id;
        } else if (user.business_id) {
          req.user.business_id = user.business_id;
        }
        next();
      } else {
        return next(new ErrorResponse(status.UNAUTHORIZED, 401));
      }
    }
  } catch (err) {
    return next(new ErrorResponse(status.UNAUTHORIZED, 401));
  }
};
