const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const { extractCookie } = require("../../utils/cookie-parser");
const moment = require("moment");

exports.login = async (req, res, next) => {
  let data = req.body;
  if (!data.provider) {
    if (!data.email || !data.password) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let usersRef = firestore.collection("users");
    let user = await usersRef.where("email", "==", data.email).limit(1).get();

    if (user.empty) {
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_EMAIL });
    }

    let password, id;

    user.forEach((doc) => {
      password = doc.data().password;
      id = doc.id;
    });

    let verifyPassword = await HASH.verifyHash(data.password, password);

    if (!verifyPassword) {
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_PASS });
    } else {
      await sendToken({ user_id: id }, res);
    }
  } else {
    if (!data.provider || !data.email) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let usersRef = firestore.collection("users");
    let user = await usersRef.where("email", "==", data.email).limit(1).get();

    if (user.empty) {
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_EMAIL });
    }

    let id;

    user.forEach((doc) => {
      id = doc.id;
    });
    await sendToken({ user_id: id }, res);
  }
};

exports.signup = async (req, res, next) => {
  let data = req.body;

  if (!data.provider) {
    if (!data.email || !data.password || !data.name || !data.mobile_no) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let usersRef = firestore.collection("users");
    let user = await usersRef.where("email", "==", data.email).limit(1).get();

    if (!user.empty) {
      return res
        .status(403)
        .json({ success: false, message: status.EMAIL_USED });
    }

    user = await usersRef
      .where("mobile_no", "==", data.mobile_no)
      .limit(1)
      .get();

    if (!user.empty) {
      return res
        .status(403)
        .json({ success: false, message: status.MOBILE_USED });
    }

    data.password = await HASH.generateHash(data.password, 10);
    data.created_at = new Date();
    delete data.repassword;
  } else {
    if (!data.email || !data.provider) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let usersRef = firestore.collection("users");
    let user = await usersRef.where("email", "==", data.email).limit(1).get();

    if (!user.empty) {
      return res
        .status(403)
        .json({ success: false, message: status.EMAIL_USED });
    }
  }

  user = await firestore.collection("users").add({ ...data });
  await sendToken({ user_id: user.id }, res);
};

exports.getUser = async (req, res, next) => {
  firestore
    .collection("users")
    .doc(req.user.id)
    .get()
    .then((userDoc) => {
      if (userDoc.exists) {
        let user = userDoc.data();
        user.id = userDoc.id;
        res.status(200).json({ success: true, data: user });
      }
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.verifyOtp = async (req, res, next) => {
  await firestore
    .collection("users")
    .doc(req.user.id)
    .set({ verify_otp: true }, { merge: true })
    .then((user) => {
      res.status(200).json({ success: true });
    })
    .catch((err) => {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.verifySession = async (req, res, next) => {
  let cookie = await extractCookie(req, res);

  if (!cookie) {
    return res
      .status(403)
      .json({ success: false, message: status.UNAUTHORIZED });
  }
let user = req.user
  if (user.blocked) {
    let bl = moment(user.blocked.split("-"));
    let curr = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .format("yyyy-mm-dd")
      .split("-");
    let diff = curr.diff(bl, "days");

    if (diff <= 2) {
      return res.status(401).json({ success: false, message: status.BLOCK });
    }

    delete user.blocked;
    delete user.join;
  }

  if (req.user.join && req.user.join != cookie.rest_id) {
    return res
      .status(401)
      .json({ success: false, message: status.SESSION_EXIST_REST });
  }

  let customersRef = await firestore
    .collection(`restaurants`)
    .doc(cookie.rest_id);

  if (cookie.table == "takeaway") {
    let takeawayRef = await firestore
      .collection("restaurants")
      .doc(cookie.rest_id)
      .collection("takeaway")
      .doc("users");
    let takeawayUsers = await takeawayRef.get();

    let dataCust = takeawayUsers.data();

    if (dataCust?.customers && dataCust?.customers.length != 0) {
      let customers = dataCust.customers;
      for (ele of customers) {
        if (ele.cid == req.user.id) {
          if (ele.req) {
            return res.status(200).json({
              success: true,
            });
          } else if (ele.req == false) {
            return res.status(403).json({
              success: false,
              message: status.REJECT_REQUEST,
            });
          }
          return res.status(200).json({
            success: true,
            message: status.REQUEST_SENT_ALLREADAY,
          });
        }
      }

      customers.push({
        table: cookie.table,
        cid: req.user.id,
        cname: req.user.name,
        checkout: false,
      });
      await takeawayRef.set({ customers: [...customers] }, { merge: true });
    } else {
      let obj = {
        table: cookie.table,
        cid: req.user.id,
        cname: req.user.name,
        checkout: false,
      };
      await takeawayRef.set({ customers: [{ ...obj }] }, { merge: true });
    }
  } else {
    let data = await customersRef.get();
    if (!data.exists) {
      return res
        .status(403)
        .json({ success: false, message: status.UNAUTHORIZED });
    }
    data = data.data();

    if (data.customers && data.customers.length != 0) {
      let customers = data.customers;

      if (Number(cookie.table) > Number(data.tables)) {
        return res
          .status(403)
          .json({ success: false, message: status.UNAUTHORIZED });
      }

      for (ele of customers) {
        if (ele.cid == req.user.id) {
          if (
            Number(ele.table) == Number(cookie.table) &&
            ele.checkout == false
          ) {
            return res.status(200).json({ success: true });
          } else {
            return res
              .status(403)
              .json({ success: false, message: status.FORBIDDEN });
          }
        } else if (Number(ele.table) == Number(cookie.table)) {
          return res
            .status(403)
            .json({ success: false, message: status.SESSION_EXIST });
        }
      }
      customers.push({
        table: cookie.table,
        cid: req.user.id,
        cname: req.user.name,
        checkout: false,
      });

      await customersRef.set({ customers: [...customers] }, { merge: true });

      return res.status(200).json({ success: true });
    } else {
      let obj = {
        table: cookie.table,
        cid: req.user.id,
        cname: req.user.name,
        checkout: false,
      };
      await customersRef.set({ customers: [{ ...obj }] }, { merge: true });
    }
  }

  user.join = cookie.rest_id;
  await firestore
    .collection("users")
    .doc(`${req.user.id}`)
    .set(user, { merge: true });

    if(cookie.table == 'takeaway'){
      return res.status(200).json({ success: true, request: true, message: status.REQUEST_SENT });
    }

    return res.status(200).json({ success: true });
 
};

sendToken = async (data, res) => {
  let token = await TOKEN.generateToken(data);
  return res.status(200).json({ success: true, token: token });
};
