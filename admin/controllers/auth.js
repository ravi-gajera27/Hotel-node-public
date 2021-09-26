const firestore = require("firebase-admin").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const moment = require("moment");
const sgMail = require("@sendgrid/mail");
const randomstring = require("randomstring");
const logger = require("../../config/logger");
const { extractErrorMessage } = require("../../utils/error");
const { incZoneReq } = require("../../utils/zone");
const size = require("firestore-size");
const { LoginActivityModel } = require("../../models/loginActivity");
const { InvoiceModel } = require("../../models/invoice");
exports.login = async (req, res, next) => {
  try {
    let data = req.body;
    console.log(req.body);

    if (!data.email || !data.password) {
      await incZoneReq(req.ip, "login");
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let usersRef = firestore.collection("admin");
    let user = await usersRef.where("email", "==", data.email).limit(1).get();

    if (user.empty) {
      await incZoneReq(req.ip, "login");
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_EMAIL });
    }

    let password, id, rest_id, tempUser;

    user.forEach((doc) => {
      tempUser = doc.data();
      password = tempUser.password;
      id = doc.id;
      rest_id = tempUser.rest_id;
    });

    let verifyPassword = await HASH.verifyHash(data.password, password);

    if (!verifyPassword) {
      await incZoneReq(req.ip, "login");
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_PASS });
    } else {
      if (rest_id) {
        console.log(rest_id);
        let obj = {
          name: tempUser.f_name + " " + tempUser.l_name,
          role: tempUser.role,
          device: data.device,
          time: moment().utcOffset(process.env.UTC_OFFSET).unix(),
        };

        let model = await LoginActivityModel.findOne({
          rest_id: rest_id,
        });

        let activities = model?.activities || [];
        if (activities && activities.length > 0) {
          if (activities.length == 15) {
            activities.shift();
          }
          activities.push({ ...obj });
          await LoginActivityModel.findByIdAndUpdate(model.id, {
            activities: activities,
          });
        } else {
          await LoginActivityModel.create({
            activities: [{ ...obj }],
            rest_id: rest_id,
          });
        }

        await sendToken({ user_id: id, rest_id: rest_id }, res);
      } else {
        await sendToken({ user_id: id }, res);
      }
    }
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({ label: `admin auth login`, message: e });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getLoginActivities = async (req, res, next) => {
  try {
    let model = await LoginActivityModel.findOne({ rest_id: req.user.rest_id });

    res.status(200).json({ success: true, data: model.activities || [] });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth getLoginActivities ${req.user.rest_id}`,
      message: e,
    });

    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};
exports.resetPassword = async (req, res, next) => {
  try {
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
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth resetPassword ${req.user.rest_id}`,
      message: e,
    });

    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.signup = async (req, res, next) => {
  try {
    let data = req.body;

    if (
      !data.email ||
      !data.password ||
      !data.f_name ||
      !data.l_name ||
      !data.mobile_no
    ) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let usersRef = firestore.collection("admin");
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
    data.created_at = moment().format("YYYY-MM-DD");
    delete data.repassword;
    data.role = "owner";
    user = await firestore.collection("admin").add({ ...data });
    await incZoneReq(req.ip, "signup");
    await sendToken({ user_id: user.id }, res);
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth signup ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.addAdmin = async (req, res, next) => {
  try {
    let data = req.body;

    if (data.password != data.confirm_password) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    if (
      !data.email ||
      !data.password ||
      !data.f_name ||
      !data.l_name ||
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
      return res
        .status(403)
        .json({ success: false, message: status.EMAIL_USED });
    }

    data.password = await HASH.generateHash(data.password, 10);
    data.created_at = moment().format("YYYY-MM-DD");
    delete data.confirm_password;
    data.rest_id = req.user.rest_id;
    data.role = "admin";
    user = await firestore.collection("admin").add({ ...data });
    res.status(200).json({ success: true, message: status.SUCCESS_ADDED });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth addAdmin ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getAdminList = async (req, res) => {
  try {
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
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth getAdminList ${req.user.rest_id}`,
      message: e,
    });
  }
};

exports.removeAdmin = async (req, res) => {
  try {
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
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth removeAdmin ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.addCaptain = async (req, res, next) => {
  try {
    let data = req.body;

    if (data.password != data.confirm_password) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    if (
      !data.email ||
      !data.password ||
      !data.f_name ||
      !data.l_name ||
      !data.confirm_password
    ) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    if (req.user.role != "owner" && req.user.role != "admin") {
      return res
        .status(403)
        .json({ success: false, message: status.FORBIDDEN_REQ });
    }

    let usersRef = firestore.collection("admin");
    let user = await usersRef
      .where("email", "==", data.email)
      .where("role", "==", "captain")
      .limit(1)
      .get();

    if (!user.empty) {
      return res
        .status(403)
        .json({ success: false, message: status.EMAIL_USED });
    }

    data.password = await HASH.generateHash(data.password, 10);
    data.created_at = moment().format("YYYY-MM-DD");
    delete data.confirm_password;
    data.rest_id = req.user.rest_id;
    data.role = "captain";
    user = await firestore.collection("admin").add({ ...data });
    res.status(200).json({ success: true, message: status.SUCCESS_ADDED });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain auth addCaptain ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getCaptainList = async (req, res) => {
  try {
    if (req.user.role != "owner" && req.user.role != "admin") {
      return res
        .status(403)
        .json({ success: false, message: status.FORBIDDEN_REQ });
    }

    let captainRef = await firestore.collection("admin");
    let captain = await captainRef
      .where("rest_id", "==", req.user.rest_id)
      .where("role", "==", "captain")
      .get();

    let captainList = [];

    captain.docs.forEach(async (doc) => {
      let data = doc.data();
      delete data.password;
      delete data.rest_id;
      captainList.push(data);
    });

    res.status(200).json({ success: true, data: captainList });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain auth getCaptainList ${req.user.rest_id}`,
      message: e,
    });
  }
};

exports.removeCaptain = async (req, res) => {
  try {
    let email = req.params.email;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    if (req.user.role != "owner" && req.user.role != "admin") {
      return res
        .status(403)
        .json({ success: false, message: status.FORBIDDEN_REQ });
    }

    let captainRef = await firestore.collection("admin");
    let captain = await captainRef
      .where("email", "==", email)
      .where("rest_id", "==", req.user.rest_id)
      .where("role", "==", "captain")
      .limit(1)
      .get();

    if (captain.empty) {
      return res
        .status(403)
        .json({ success: false, message: status.UNAUTHORIZED });
    }

    for (let doc of captain.docs) {
      await firestore.collection("admin").doc(doc.id).delete();
    }

    res.status(200).json({ success: true, message: status.SUCCESS_REMOVED });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain auth removeCaptain ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.resetPasswordCaptain = async (req, res, next) => {
  try {
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

    let captain = await firestore.collection("captain").doc(req.user.id).get();
    let pass = await HASH.verifyHash(
      data.cur_password,
      captain.data().password
    );
    if (!pass) {
      return res
        .status(400)
        .json({ success: false, message: status.PASSWORD_MISMATCH });
    }
    let new_pass = await HASH.generateHash(data.new_password, 10);

    await firestore
      .collection("captain")
      .doc(req.user.id)
      .set({ password: new_pass }, { merge: true });
    res.status(200).json({ success: true, message: status.SUCCESS_CHANGED });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain auth resetPassword ${req.user.rest_id}`,
      message: e,
    });

    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.restaurantRegister = async (req, res, next) => {
  try {
    req.body.created_at = moment().format("YYYY-MM-DD");
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
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth restaurantRegister ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.updateRestaurantDetails = async (req, res, next) => {
  firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .set({ ...req.body }, { merge: true })
    .then(async (profile) => {
      if (req.params.tables && req.params.tables == "tables") {
        await firestore
          .collection("restaurants")
          .doc(req.user.rest_id)
          .collection("customers")
          .doc("users")
          .set({ type: req.body.type }, { merge: true });
      }
      return res
        .status(200)
        .json({ success: true, message: status.SUCCESS_UPDATED });
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `admin auth updateRestaurantDetails ${req.user.rest_id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.updateStepRestaurantDetaials = async (req, res, next) => {
  firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .set({ ...req.body }, { merge: true })
    .then(async (profile) => {
      return res.status(200).json({ success: true, message: "Success" });
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `admin auth updateStepRestaurantDetaials ${req.user.rest_id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.addMenuFileRestStep = async (req, res, next) => {
  try {
    if (!req.body.restType) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let categories = req.body.categories;
    let menu = req.body.menu;
    
    if (categories.length != 0) {
      await firestore
        .collection("restaurants")
        .doc(req.user.rest_id)
        .collection("categories")
        .add({ cat: [...categories] });
    }

    if (menu.length != 0) {
      let tempMenu = [];
      for (let ele of menu) {
        valid = false;
        let id;
        do {
          id = await generateRandomStringForMenu();
          valid = false;
          for (let m of tempMenu) {
            if (m.id == id) {
              valid = true;
              break;
            }
          }
        } while (valid);

        ele.id = id;
        tempMenu.push({ ...ele });
      }
      await firestore
        .collection("restaurants")
        .doc(req.user.rest_id)
        .collection("menu")
        .doc("menu")
        .set({ menu: [...tempMenu] });
    }
    let typeObject = {};
    if (req.body.restType.length < 2) {
      typeObject.type = req.body.restType;
    } else {
      typeObject.type = req.body.restType;
      typeObject.take_menu = req.body.restType[0].value;
    }
    let customersRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");
    firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .set({ ...typeObject }, { merge: true })
      .then(async (profile) => {
        await customersRef.set({ ...typeObject }, { merge: true });
        return res.status(200).json({ success: true, message: "Success" });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth addMenuFileRestStep ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
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
        if (data.rest_id) {
          let restRef = await firestore
            .collection(`restaurants`)
            .doc(data.rest_id)
            .get();
          restRef = restRef.data();
          if (restRef.verified) {
            data.verified = true;
          }
          if (restRef.locked) {
            data.locked = true;
          }
          if (restRef.invoice_format) {
            data.invoice = true;
          }
          if (restRef.tables || restRef.type?.length >= 0) {
            data.table = true;
          }
          delete data.rest_id;
          data.rest = true;
        }
        if (data.role == "admin") {
          data.verify_otp = true;
        }

        res.status(200).json({ success: true, data: data });
      } else {
        res.status(401).json({ success: false, redirect: "/login" });
      }
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `admin auth getUser ${req.user.rest_id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.forgotPasswordCheckMail = async (req, res) => {
  try {
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
    sgMail.send(msg).then(() => {
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
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth forgotPasswordCheckMail ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.checkVerificationCodeForForgotPass = async (req, res) => {
  try {
    let data = req.body;
    console.log(data);
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
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth checkVerificationCode ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.changePassword = async (req, res) => {
  try {
    let { email, new_pass, confirm_pass, code } = req.body;
    if (!email || !new_pass || !confirm_pass || !code) {
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

    if (tempuser.ver_code != code) {
      return res
        .status(404)
        .json({ success: false, message: status.UNAUTHORIZED });
    }

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
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth changepassword ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
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
      let e = extractErrorMessage(err);
      logger.error({
        label: `admin auth verifyOtp ${req.user.rest_id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.getRestDetails = async (req, res) => {
  try {
    if (!req.user.rest_id) {
      return res.status(401).json({
        success: false,
        message: status.NOT_REGISTERED,
        redirect: "/restaurant-information",
      });
    }

    let restDetailsDoc = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .get();

    if (!restDetailsDoc.exists) {
      return res.status(401).json({
        success: false,
        message: status.NOT_REGISTERED,
        redirect: "/restaurant-information",
      });
    }

    let restData = restDetailsDoc.data();

    if (!restData.verified) {
      return res.status(401).json({
        success: false,
        message: status.NOT_VERIFIED,
        redirect: "/restaurant-verification",
      });
    } else if (!restData.invoice_format) {
      return res.status(401).json({
        success: false,
        message: status.REST_STEP_INCOMPLETE,
        redirect: "/restaurant-invoice",
      });
    } else if (!restData.tables && !restData.type) {
      return res.status(401).json({
        success: false,
        message: status.REST_STEP_INCOMPLETE,
        redirect: "/restaurant-menu",
      });
    } else if (restData.locked) {
      return res.status(401).json({
        success: false,
        message: status.LOCKED,
        redirect: "/lock",
      });
    }

    delete restData.verified;
    delete restData.locked;

    /*   restData.type = [
      {name: 'AC', value: 'ac'},
      {name: 'NAC', value: 'nac'},
      {name: 'Garden', value: 'ga'},
      {name: 'Terrace', value: 'te'}
    ] */

    return res.status(200).json({ success: true, data: restData });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin auth getRestDetails ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
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

async function generateRandomStringForMenu() {
  return await randomstring.generate({
    length: 12,
    charset: "alphabetic",
  });
}
