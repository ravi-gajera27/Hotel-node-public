const HASH = require("../utils/token");
const status = require("../utils/status");
const admin = require("firebase-admin");
const firstore = admin.firestore();

exports.protect = async (req, res, next) => {
  let token;
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    token = req.headers.authorization.split(" ")[1];
  }

  // Make sure token exists
  if (!token) {
    return res
      .status(401)
      .json({ success: false, message: status.UNAUTHORIZED });
  }

  try {
    // Verify token
    const decoded = await HASH.verifyToken(token);
    if (!decoded) {
      return res
        .status(401)
        .json({ success: false, message: status.UNAUTHORIZED });
    } else {
      let user = await firstore.collection("super-admin").doc(decoded.user_id).get();
      if (user.exists) {
        req.user = user.data();
        req.user.id = user.id;
        next();
      } else {
        return res
          .status(401)
          .json({ success: false, message: status.UNAUTHORIZED });
      }
    }
  } catch (err) {
    return res
      .status(401)
      .json({ success: false, message: status.UNAUTHORIZED });
  }
};
