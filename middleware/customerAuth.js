const HASH = require("../utils/token");
const status = require("../utils/status");
const admin = require("firebase-admin");
const firstore = admin.firestore();
const io = require("socket.io");
const { CustomerModel } = require("../models/customer");

exports.protect = async (req, res, next) => {
  console.log(req.baseUrl);
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
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
      let user = await CustomerModel.findById(decoded.user_id);
      if (user) {
        req.user = user;
        next();
      } else {
        res.status(401).json({ success: false, message: status.UNAUTHORIZED });
      }
    }
  } catch (err) {
    res.status(401).json({ success: false, message: status.UNAUTHORIZED });
  }
};
