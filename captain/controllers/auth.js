const firestore = require("firebase-admin").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const sgMail = require("@sendgrid/mail");
const randomstring = require("randomstring");
const logger = require("../../config/logger");
const { extractErrorMessage } = require("../../utils/error");
const { incZoneReq } = require("../../utils/zone");
const { INVALID_TABLE } = require("../../utils/status");
const { LoginActivityModel } = require("../../models/loginActivity");
const moment = require("moment");
const { CustomerModel } = require("../../models/customer");

exports.login = async (req, res, next) => {
  try {
    let data = req.body;

    if (!data.email || !data.password) {
      await incZoneReq(req.ip, "login");
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let usersRef = firestore.collection("admin");
    let user = await usersRef
      .where("email", "==", data.email)
      .where("role", "==", "captain")
      .limit(1)
      .get();

    if (user.empty) {
      await incZoneReq(req.ip, "login");
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_EMAIL });
    }

    let password, id, rest_id, tempUser;

    user.docs.forEach((doc) => {
      tempUser = doc.data();
      password = doc.data().password;
      id = doc.id;
      rest_id = doc.data().rest_id;
    });

    let verifyPassword = await HASH.verifyHash(data.password, password);

    if (!verifyPassword) {
      await incZoneReq(req.ip, "login");
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_PASS });
    } else {
      let obj = {
        name: tempUser.f_name + " " + tempUser.l_name,
        role: tempUser.role,
        device: data.device,
        time: moment().utcOffset(process.env.UTC_OFFSET).unix(),
      };

      let model = await LoginActivityModel.findOne({
        rest_id: tempUser.rest_id,
      });
      let activities = model.activities || [];
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
          rest_id: tempUser.rest_id,
        });
      }

      await sendToken({ user_id: id, rest_id: tempUser.rest_id }, res);
    }
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain auth login`,
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
    .then((userDoc) => {
      if (userDoc.exists) {
        let user = userDoc.data();
        let obj = {
          name: user.f_name + " " + user.l_name,
          email: user.email,
          mobile_no: user.mobile_no,
          id: userDoc.id,
        };
        res.status(200).json({
          success: true,
          data: obj,
        });
      }
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `captain auth getUser ${req.user.id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.verifyMobileNo = async (req, res) => {
  try {
    let data = req.body;
    if (!data.mobile_no || !data.members) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let user = await CustomerModel.findOne({ mobile_no: data.mobile_no });

    return res
      .status(200)
      .json({ success: true, data: user ? user.cname : "" });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain auth verifyMobileNo ${req.user.id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.verifySession = async (req, res) => {
  try {
    if (
      !req.body.table ||
      !req.body.cname ||
      !req.body.mobile_no ||
      !req.body.members
    ) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let custData = {
      cname: req.body.cname,
      mobile_no: req.body.mobile_no,
      dob:
        moment(req.body.dob)
          .utcOffset(process.env.UTC_OFFSET)
          .format("YYYY-MM-DD") || "",
    };

    let user = await CustomerModel.findOne({ mobile_no: custData.mobile_no });

    if (!user) {
      user = await CustomerModel.create({ ...custData });
    }

    let customersRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");

    await firestore
      .runTransaction(async (t) => {
        let data = (await t.get(customersRef)).data();
        let customers = data.seat || [];
        let total_tables = 0;
        if (req.body.type) {
          let index = data.type
            .map((e) => {
              return e.value;
            })
            .indexOf(req.body.type);
          total_tables = data.type[index].tables;
        } else {
          total_tables = data.type[0].tables;
        }
        if (Number(req.body.table) > Number(total_tables)) {
          return Promise.resolve({
            success: false,
            status: 400,
            message: INVALID_TABLE,
          });
        }

        flag = true;
        msg = ''
        if (req.body.type) {
          for (let cust of customers) {
            if (cust.cid == user.id.toString()) {
              flag = false;
              msg = status.OCCUPIED_CAP
              break;
            }
            if (
              Number(cust.table) == Number(req.body.table) &&
              cust.type == req.body.type &&
              !cust.restore
            ) {
              flag = false;
              msg = status.SESSION_EXIST_CAP
              break;
            }
          }
        } else {
          for (let cust of customers) {
            if (cust.cid == user.id.toString()) {
              flag = false;
              msg = status.OCCUPIED_CAP
              break;
            }
            if (Number(cust.table) == Number(req.body.table) && !cust.restore) {
              flag = false;
              msg = status.SESSION_EXIST_CAP
              break;
            }
          }
        }

        if (!flag) {
          return Promise.resolve({
            success: false,
            status: 403,
            message: msg,
          });
        }

        let obj = {};
        if (req.body.type) {
          obj = {
            checkout: false,
            cname: user.cname,
            cid: user._id.toString(),
            table: req.body.table,
            captain_id: req.user.id,
            type: req.body.type,
            members: req.body.members,
          };
        } else {
          obj = {
            checkout: false,
            cname: user.cname,
            cid: user._id.toString(),
            table: req.body.table,
            captain_id: req.user.id,
            members: req.body.members,
          };
        }

        customers.push(obj);

        await t.set(customersRef, { seat: [...customers] }, { merge: true });
        return Promise.resolve({
          status: 200,
          message: "Success",
          success: true,
        });
      })
      .then((promise) => {
        return res
          .status(promise.status)
          .json({ success: promise.success, message: promise.message });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain auth verifySession ${req.user.id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.forgotPasswordCheckMail = async (req, res) => {
  try {
    let email = req.body.email;

    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let captainRef = firestore.collection("admin");
    let captain = await captainRef
      .where("email", "==", email)
      .where("role", "==", "captain")
      .limit(1)
      .get();

    if (captain.empty) {
      return res
        .status(400)
        .json({ success: false, message: status.INVALID_EMAIL });
    }

    let captain_id = captain.docs[0].id;

    let code = await generateRandomStringForVerfication();

    const msg = {
      to: email, // Change to your recipient
      from: "peraket.dev@gmail.com", // Change to your verified sender
      subject: "Verification Code",
      text: `Your verification code for forgot password is ${code}`,
    };
    sgMail.send(msg).then(() => {
      captainRef
        .doc(captain_id)
        .set({ ver_code: code }, { merge: true })
        .then(
          (e) => {
            return res.status(200).json({
              success: true,
              message: "We have sent verification code on you registered email",
            });
          },
          (err) => {
            throw err;
          }
        );
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain auth forgotPasswordCheckMail ${req.user.id}`,
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

    if (!data.email || !data.code) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let captainRef = firestore.collection("admin");
    let captain = await captainRef
      .where("email", "==", data.email)
      .where("role", "==", "captain")
      .limit(1)
      .get();

    if (captain.empty) {
      return res
        .status(404)
        .json({ success: false, message: status.UNAUTHORIZED });
    }

    captain_id = captain.docs[0].id;
    let tempuser;
    captain.docs.forEach((e) => {
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
      label: `captain auth  checkVerificationCodeForForgotPass ${req.user.id}`,
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

    let captainRef = firestore.collection("admin");
    let captain = await captainRef
      .where("email", "==", email)
      .where("role", "==", "captain")
      .get();

    if (captain.empty) {
      return res
        .status(404)
        .json({ success: false, message: status.UNAUTHORIZED });
    }

    let tempuser;
    captain.docs.forEach((e) => {
      tempuser = e.data();
    });

    captain_id = captain.docs[0].id;

    if (tempuser.ver_code != code) {
      return res
        .status(404)
        .json({ success: false, message: status.UNAUTHORIZED });
    }

    tempuser.password = await HASH.generateHash(new_pass, 10);
    delete tempuser.ver_code;

    usersRef
      .doc(captain_id)
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
      label: `customer auth  changePassword ${req.user.id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

sendToken = async (data, res) => {
  let token = await TOKEN.generateToken(data);
  return res.status(200).json({
    success: true,
    token: token,
  });
};

async function generateRandomString() {
  return await randomstring.generate({
    length: 12,
    charset: "alphabetic",
  });
}

async function generateRandomStringForVerfication() {
  return await randomstring.generate({
    length: 6,
    charset: "numeric",
  });
}
