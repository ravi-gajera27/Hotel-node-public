const firestore = require("firebase-admin").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const moment = require("moment");
const sgMail = require("@sendgrid/mail");
const randomstring = require("randomstring");
sgMail.setApiKey(process.env.FORGOT_PASS_API_KEY);

exports.login = async (req, res, next) => {
  let data = req.body;

  if (!data.email || !data.password) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let usersRef = firestore.collection("super-admin");
  let user = await usersRef.where("email", "==", data.email).limit(1).get();

  if (user.empty) {
    return res
      .status(401)
      .json({ success: false, message: status.INVALID_EMAIL });
  }

  let password, id, rest_id;

  user.forEach((doc) => {
    password = doc.data().password;
    id = doc.id;
    rest_id = doc.data().rest_id;
  });

  let verifyPassword = await HASH.verifyHash(data.password, password);

  if (!verifyPassword) {
    return res
      .status(401)
      .json({ success: false, message: status.INVALID_PASS });
  } else {
    if (rest_id) {
      await sendToken({ user_id: id }, res);
    } else {
      await sendToken({ user_id: id }, res);
    }
  }
};


sendToken = async (data, res) => {
    let token = await TOKEN.generateToken(data);
    return res.status(200).json({ success: true, token: token });
  };
  
  async function generateRandomString() {
    return await randomstring.generate({
      length: 6,
      charset: "numeric",
    });
  }