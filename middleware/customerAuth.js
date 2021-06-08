const ErrorResponse = require('../utils/errorResponse');
const HASH = require('../utils/token');
const status = require('../utils/status');
const admin = require('firebase-admin');
const firstore = admin.firestore()

exports.protect = async (req, res, next) => {
  console.log(req.baseUrl)
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith('Bearer')
  ) {
    token = req.headers.authorization.split(' ')[1];
  }

  // Make sure token exists
  if (!token) {
    res.status(401).json({ success: false, message: status.UNAUTHORIZED });
  }

  try {
    // Verify token
    const decoded = await HASH.verifyToken(token);
    if (!decoded) {
      res.status(401).json({ success: false, message: status.UNAUTHORIZED });
    } else {
      let user = await firstore.collection('users').doc(decoded.user_id).get()
      if (user.exists) {
        req.user = user.data();
        req.user.id = user.id;
        next();
      } else {
        res.status(401).json({ success: false, message: status.UNAUTHORIZED });
      }
    }
  } catch (err) {
    res.status(401).json({ success: false, message: status.UNAUTHORIZED });
  }
};
