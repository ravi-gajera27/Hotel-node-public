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
  console.log(req.body);

  if (!data.email || !data.password) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let usersRef = firestore.collection("admin");
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
      await sendToken({ user_id: id, rest_id: rest_id }, res);
    } else {
      await sendToken({ user_id: id }, res);
    }
  }
};
exports.resetPassword = async (req, res, next) => {
  let data = req.body;

  if (!data.cur_password || !data.new_password || !data.re_password) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  if (data.new_password != data.re_password) {
    return res
      .status(400)
      .json({ success: false, message: status.PASSWORD_NOT_EQUAL });
  }

  let admin = await firestore.collection("admin").doc(req.user.id).get();
  let pass = await HASH.verifyHash(data.cur_password, admin.data().password);
  if (!pass) {
    return res
      .status(400)
      .json({ success: false, message: status.PASSWORD_MISMATCH });
  }
  let new_pass = await HASH.generateHash(data.new_password, 10);

  await firestore
    .collection("admin")
    .doc(req.user.id)
    .set({ password: new_pass }, { merge: true });
  res.status(200).json({ success: true, message: status.SUCCESS_CHANGED });
};

exports.signup = async (req, res, next) => {
  let data = req.body;

  if (
    !data.email ||
    !data.password ||
    !data.first_name ||
    !data.last_name ||
    !data.mobile_no
  ) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let usersRef = firestore.collection("admin");
  let user = await usersRef.where("email", "==", data.email).limit(1).get();

  if (!user.empty) {
    return res.status(403).json({ success: false, message: status.EMAIL_USED });
  }

  user = await usersRef.where("mobile_no", "==", data.mobile_no).limit(1).get();

  if (!user.empty) {
    return res
      .status(403)
      .json({ success: false, message: status.MOBILE_USED });
  }

  data.password = await HASH.generateHash(data.password, 10);
  data.created_at = moment().format("YYYY-MM-DD");
  delete data.repassword;
  data.role = "owner";
  user = await firestore.collection("admin").add({ ...data });
  await sendToken({ user_id: user.id }, res);
};

exports.addAdmin = async (req, res, next) => {
  let data = req.body;

  if (data.password != data.confirm_password) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  if (
    !data.email ||
    !data.password ||
    !data.first_name ||
    !data.last_name ||
    !data.confirm_password
  ) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  if (req.user.role != "owner") {
    return res
      .status(403)
      .json({ success: false, message: status.FORBIDDEN_REQ });
  }

  let usersRef = firestore.collection("admin");
  let user = await usersRef.where("email", "==", data.email).limit(1).get();

  if (!user.empty) {
    return res.status(403).json({ success: false, message: status.EMAIL_USED });
  }

  data.password = await HASH.generateHash(data.password, 10);
  data.created_at = moment().format("YYYY-MM-DD");
  delete data.confirm_password;
  data.rest_id = req.user.rest_id;
  data.role = "admin";
  user = await firestore.collection("admin").add({ ...data });
  res.status(200).json({ success: true, message: status.SUCCESS_ADDED });
};

exports.getAdminList = async (req, res) => {
  if (req.user.role != "owner") {
    return res
      .status(403)
      .json({ success: false, message: status.FORBIDDEN_REQ });
  }

  let adminRef = await firestore.collection("admin");
  let admin = await adminRef
    .where("rest_id", "==", req.user.rest_id)
    .where("role", "==", "admin")
    .get();

  let adminList = [];

  admin.forEach(async (doc) => {
    let data = doc.data();
    delete data.password;
    delete data.rest_id;
    adminList.push(data);
  });

  res.status(200).json({ success: true, data: adminList });
};

exports.removeAdmin = async (req, res) => {
  let email = req.params.email;

  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  if (req.user.role != "owner") {
    return res
      .status(403)
      .json({ success: false, message: status.FORBIDDEN_REQ });
  }

  let adminRef = await firestore.collection("admin");
  let admin = await adminRef
    .where("email", "==", email)
    .where("rest_id", "==", req.user.rest_id)
    .limit(1)
    .get();

  if (admin.empty) {
    return res
      .status(403)
      .json({ success: false, message: status.UNAUTHORIZED });
  }

  for (let doc of admin.docs) {
    await firestore.collection("admin").doc(doc.id).delete();
  }

  res.status(200).json({ success: true, message: status.SUCCESS_REMOVED });
};

exports.restaurantRegister = async (req, res, next) => {
  req.body.created_at = new Date();
  req.body.owner_id = req.user.id;

  if (req.user.rest_id) {
    return res
      .status(403)
      .json({ success: false, message: status.ALREARY_REGISTRED });
  }

  firestore
    .collection("restaurants")
    .add({ ...req.body })
    .then(async (profile) => {
      await firestore
        .collection("admin")
        .doc(req.user.id)
        .set({ rest_id: profile.id }, { merge: true });
      data = {
        user_id: req.user.id,
        rest_id: profile.id,
      };
      sendToken(data, res);
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.updateRestaurantDetaials = async (req, res, next) => {
  firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .set({ ...req.body }, { merge: true })
    .then(async (profile) => {
      return res
        .status(200)
        .json({ success: true, message: status.SUCCESS_UPDATED });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.getUser = async (req, res, next) => {
  firestore
    .collection("admin")
    .doc(req.user.id)
    .get()
    .then(async (user) => {
      if (user.exists) {
        let data = user.data();
        delete data.password;
        if (data.role == "owner") {
          if (data.rest_id) {
            let restRef = await firestore
              .collection(`restaurants`)
              .doc(data.rest_id)
              .get();
            restRef = restRef.data();
            if (restRef.verified) {
              data.verified = true;
            } else {
              data.verified = false;
            }
            delete data.rest_id;
            data.rest = true;
          }
        } else if (data.role == "admin") {
          delete data.rest_id;
          data.rest = true;
          data.verified = true;
          data.verifyOtp = true;
        }

        res.status(200).json({ success: true, data: data });
      } else {
        res.status(401).json({ success: false, redirect: "/login" });
      }
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.forgotPasswordCheckMail = async (req, res) => {
  let email = req.body.email;
  console.log(req.body);
  if (!email) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let usersRef = firestore.collection("admin");
  let user = await usersRef.where("email", "==", email).limit(1).get();

  if (user.empty) {
    return res
      .status(400)
      .json({ success: false, message: status.INVALID_EMAIL });
  }

  let user_id = user.docs[0].id;

  let code = await generateRandomString();

  const msg = {
    to: email, // Change to your recipient
    from: "peraket.dev@gmail.com", // Change to your verified sender
    subject: "Verification Code",
    text: `Your verification code for forgot password id ${code}`,
  };
  sgMail
    .send(msg)
    .then(() => {
      usersRef
        .doc(user_id)
        .set({ ver_code: code }, { merge: true })
        .then(
          (e) => {
            return res.status(200).json({
              success: true,
              message: "We have sent verification code on you registered email",
            });
          },
          (err) => {
            return res
              .status(500)
              .json({ success: false, message: status.SERVER_ERROR });
          }
        );
    })
    .catch((error) => {
      console.log(error);
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.checkVerificationCodeForForgotPass = async (req, res) => {
  let data = req.body;
  if (!data.email || !data.code) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  let usersRef = firestore.collection("admin");
  let user = await usersRef.where("email", "==", data.email).limit(1).get();

  if (user.empty) {
    return res
      .status(404)
      .json({ success: false, message: status.UNAUTHORIZED });
  }

  user_id = user.docs[0].id;
  let tempuser;
  user.docs.forEach((e) => {
    tempuser = e.data();
  });
  
  if (tempuser.ver_code != data.code) {
    return res
      .status(400)
      .json({ success: false, message: "Provide valid verification code" });
  }

  return res
    .status(200)
    .json({ success: true, message: "Successfully verified" });
};

exports.changePassword = async (req, res) => {
  let { email, new_pass, confirm_pass } = req.body;
  if (!email || !new_pass || !confirm_pass) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }

  if (new_pass != confirm_pass) {
    return res
      .status(400)
      .json({ success: false, message: status.PASSWORD_NOT_EQUAL });
  }

  let usersRef = firestore.collection("admin");
  let user = await usersRef.where("email", "==", email).get();

  if (user.empty) {
    return res
      .status(404)
      .json({ success: false, message: status.UNAUTHORIZED });
  }

  let tempuser;
  user.docs.forEach((e) => {
    tempuser = e.data();
  });

  user_id = user.docs[0].id;

  tempuser.password = await HASH.generateHash(new_pass, 10);
  delete tempuser.ver_code;

  usersRef
    .doc(user_id)
    .set(tempuser)
    .then((e) => {
      return res.status(200).json({
        success: true,
        message: "Your password is successfully changed",
      });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.verifyOtp = async (req, res, next) => {
  await firestore
    .collection("admin")
    .doc(req.user.id)
    .set({ verifyOtp: true }, { merge: true })
    .then((user) => {
      res.status(200).json({ success: true });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
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
