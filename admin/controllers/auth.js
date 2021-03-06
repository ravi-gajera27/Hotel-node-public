const admin = require('firebase-admin');
const firstore = admin.firestore();
const status = require('../../utils/status');
const HASH = require('../../utils/encryption');
const TOKEN = require('../../utils/token');
const ErrorResponse = require('../../utils/errorResponse');

exports.login = async (req, res, next) => {
  let data = req.body;

  if (!data.email || !data.password) {
    return res.status(400).json({ success: false, err: status.BAD_REQUEST });
  }

  let usersRef = firstore.collection('admin');
  let user = await usersRef.where('email', '==', data.email).limit(1).get();

  if (user.empty) {
    return res.status(401).json({ success: false, err: status.INVALID_EMAIL });
  }

  let password, id;

  user.forEach((doc) => {
    password = doc.data().password;
    id = doc.id;
  });

  let verifyPassword = await HASH.verifyHash(data.password, password);

  if (!verifyPassword) {
    return res.status(401).json({ success: false, err: status.INVALID_PASS });
  } else {
    await sendToken({ user_id: id }, res);
  }
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

  let usersRef = firstore.collection('admin');
  let user = await usersRef.where('email', '==', data.email).limit(1).get();

  if (!user.empty) {
    return res.status(403).json({ success: false, err: status.EMAIL_USED });
  }

  user = await usersRef.where('mobile_no', '==', data.mobile_no).limit(1).get();

  if (!user.empty) {
    return res.status(403).json({ success: false, err: status.MOBILE_USED });
  }

  data.password = await HASH.generateHash(data.password, 10);
  data.created_at = new Date();
  delete data.repassword;
  user = await firstore.collection('admin').add({ ...data });
  await sendToken({ user_id: user.id }, res);
};

exports.restaurantRegister = async (req, res, next) => {
  req.body.created_at = new Date();
  req.body.user_id = req.user.id;
  firstore
    .collection('restaurants')
    .add({ ...req.body })
    .then(async (profile) => {
      await firstore
        .collection('admin')
        .doc(req.user.id)
        .set({ business_id: profile.id }, { merge: true });
      data = {
        user_id: req.user.id,
        business_id: profile.id,
      };
      sendToken(data, res);
    })
    .catch((err) => {
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.getUser = async (req, res, next) => {
  firstore
    .collection('admin')
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
  await firstore
    .collection('admin')
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
