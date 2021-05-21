const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const moment = require("moment");

exports.login = async (req, res, next) => {
  let data = req.body;
  console.log(req.body);

  if (!data.email || !data.password) {
    return res.status(400).json({ success: false, err: status.BAD_REQUEST });
  }

  let usersRef = firestore.collection("admin");
  let user = await usersRef.where("email", "==", data.email).limit(1).get();

  if (user.empty) {
    return res.status(401).json({ success: false, err: status.INVALID_EMAIL });
  }

  let password, id, rest_id;

  user.forEach((doc) => {
    password = doc.data().password;
    id = doc.id;
    rest_id = doc.data().rest_id;
  });

  let verifyPassword = await HASH.verifyHash(data.password, password);

  if (!verifyPassword) {
    return res.status(401).json({ success: false, err: status.INVALID_PASS });
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
    return res.status(400).json({ success: false, err: status.BAD_REQUEST });
  }

  if (data.new_password != data.re_password) {
    return res
      .status(400)
      .json({ success: false, err: status.PASSWORD_NOT_EQUAL });
  }

  let admin = await firestore.collection("admin").doc(req.user.id).get();
  let pass = await HASH.verifyHash(data.cur_password, admin.data().password);
  if (!pass) {
    return res
      .status(400)
      .json({ success: false, err: status.PASSWORD_MISMATCH });
  }
  let new_pass = await HASH.generateHash(data.new_password, 10);

  await firestore
    .collection("admin")
    .doc(req.user.id)
    .set({ password: new_pass }, { merge: true });
  res.status(200).json({ success: true });
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
    return res.status(400).json({ success: false, err: status.BAD_REQUEST });
  }

  let usersRef = firestore.collection("admin");
  let user = await usersRef.where("email", "==", data.email).limit(1).get();

  if (!user.empty) {
    return res.status(403).json({ success: false, err: status.EMAIL_USED });
  }

  user = await usersRef.where("mobile_no", "==", data.mobile_no).limit(1).get();

  if (!user.empty) {
    return res.status(403).json({ success: false, err: status.MOBILE_USED });
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
    return res.status(400).json({ success: false, err: status.BAD_REQUEST });
  }

  if (
    !data.email ||
    !data.password ||
    !data.first_name ||
    !data.last_name ||
    !data.confirm_password
  ) {
    return res.status(400).json({ success: false, err: status.BAD_REQUEST });
  }

  if (req.user.role != "owner") {
    return res.status(401).json({ success: false, err: status.UNAUTHORIZED });
  }

  let usersRef = firestore.collection("admin");
  let user = await usersRef.where("email", "==", data.email).limit(1).get();

  if (!user.empty) {
    return res.status(403).json({ success: false, err: status.EMAIL_USED });
  }

  data.password = await HASH.generateHash(data.password, 10);
  data.created_at = moment().format("YYYY-MM-DD");
  delete data.confirm_password;
  data.rest_id = req.user.rest_id;
  data.role = "admin";
  user = await firestore.collection("admin").add({ ...data });
  res.status(200).json({ success: true });
};

exports.getAdminList = async(req, res) =>{
  if (req.user.role != "owner") {
    return res.status(401).json({ success: false, err: status.UNAUTHORIZED });
  }

  
  let adminRef = await firestore.collection("admin");
  let admin = await adminRef.where("rest_id", "==", req.user.rest_id).where('role','==','admin').get();

  let adminList = []

  admin.forEach(async (doc) => {
    let data = doc.data()
    adminList.push(data)
  });

  res.status(200).json({success: true, data: adminList})
}

exports.removeAdmin = async (req, res) => {
  let email = req.body;
  if (req.user.role != "owner") {
    return res.status(401).json({ success: false, err: status.UNAUTHORIZED });
  }

  let adminRef = await firestore.collection("admin");
  let admin = await adminRef.where("email", "==", email).limit(1).get();

  if (!adminRef.empty) {
    return res.status(403).json({ success: false, err: status.FORBIDDEN });
  }

  admin.forEach(async (doc) => {
    await doc.ref.delete();
  });

  res.status(200).json({ success: true });
};

exports.restaurantRegister = async (req, res, next) => {
  req.body.created_at = new Date();
  req.body.user_id = req.user.id;
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
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.updateRestaurantDetaials = async (req, res, next) => {
  firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .set({ ...req.body }, { merge: true })
    .then(async (profile) => {
      return res.status(200).json({ success: true });
    })
    .catch((err) => {
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.getUser = async (req, res, next) => {
  firestore
    .collection("admin")
    .doc(req.user.id)
    .get()
    .then((user) => {
      if (user.exists) {
        res.status(200).json({ success: true, data: user.data() });
      }
    })
    .catch((err) => {
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.verifyOtp = async (req, res, next) => {
  await firestore
    .collection("admin")
    .doc(req.user.id)
    .set({ verify_otp: true }, { merge: true })
    .then((user) => {
      res.status(200).json({ success: true });
    })
    .catch((err) => {
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

sendToken = async (data, res) => {
  let token = await TOKEN.generateToken(data);
  return res.status(200).json({ success: true, token: token });
};
