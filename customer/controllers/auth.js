const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const { extractCookie } = require("../../utils/cookie-parser");
const size = require("firestore-size");
const moment = require("moment");
const sgMail = require("@sendgrid/mail");
const randomstring = require("randomstring");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
const { incZoneReq } = require("../../utils/zone");
const e = require("express");
sgMail.setApiKey(process.env.FORGOT_PASS_API_KEY);

exports.login = async (req, res, next) => {
  try {
    let data = req.body;
    if (!data.provider) {
      if (!data.email || !data.password) {
        await incZoneReq(req.ip, "login");
        return res.status(400).json({
          success: false,
          message: status.BAD_REQUEST,
        });
      }

      let usersRef = firestore.collection("users");
      let user = await usersRef.where("email", "==", data.email).limit(1).get();

      if (user.empty) {
        await incZoneReq(req.ip, "login");
        return res.status(401).json({
          success: false,
          message: status.INVALID_EMAIL,
        });
      }

      let password, id;

      user.forEach((doc) => {
        password = doc.data().password;
        id = doc.id;
      });

      let verifyPassword = await HASH.verifyHash(data.password, password);

      if (!verifyPassword) {
        await incZoneReq(req.ip, "login");
        return res.status(401).json({
          success: false,
          message: status.INVALID_PASS,
        });
      } else {
        await sendToken(
          {
            user_id: id,
          },
          res
        );
      }
    } else {
      if (!data.provider || !data.email) {
        return res.status(400).json({
          success: false,
          message: status.BAD_REQUEST,
        });
      }

      let usersRef = firestore.collection("users");
      let user = await usersRef.where("email", "==", data.email).limit(1).get();

      if (user.empty) {
        data.created_at = moment()
          .utcOffset(process.env.UTC_OFFSET)
          .format("YYYY-MM-DD hh:mm A");
        let u = await firestore.collection("users").add({
          ...data,
        });
        return await sendToken(
          {
            user_id: u.id,
          },
          res
        );
      }

      let id;

      user.forEach((doc) => {
        id = doc.id;
      });
      await sendToken(
        {
          user_id: id,
        },
        res
      );
    }
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `customer auth login ${req.user.id}`,
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

    if (!data.provider) {
      if (!data.email || !data.password || !data.name) {
        return res.status(400).json({
          success: false,
          message: status.BAD_REQUEST,
        });
      }

      let usersRef = firestore.collection("users");
      let user = await usersRef.where("email", "==", data.email).limit(1).get();

      if (!user.empty) {
        return res.status(403).json({
          success: false,
          message: status.EMAIL_USED,
        });
      }

      if (data.mobile_no) {
        user = await usersRef
          .where("mobile_no", "==", data.mobile_no)
          .limit(1)
          .get();

        if (!user.empty) {
          return res.status(403).json({
            success: false,
            message: status.MOBILE_USED,
          });
        }
      } else {
        delete data.mobile_no;
      }
      data.password = await HASH.generateHash(data.password, 10);
      data.created_at = moment()
        .utcOffset(process.env.UTC_OFFSET)
        .format("YYYY-MM-DD hh:mm A");
      delete data.repassword;
    } else {
      if (!data.email || !data.provider) {
        return res.status(400).json({
          success: false,
          message: status.BAD_REQUEST,
        });
      }

      let usersRef = firestore.collection("users");
      let user = await usersRef.where("email", "==", data.email).limit(1).get();

      if (!user.empty) {
        return res.status(403).json({
          success: false,
          message: status.EMAIL_USED,
        });
      }
    }

    user = await firestore.collection("users").add({
      ...data,
    });
    await incZoneReq(req.ip, "signup");
    await sendToken(
      {
        user_id: user.id,
      },
      res
    );
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `customer auth signup ${req.user.id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getUser = async (req, res, next) => {
  firestore
    .collection("users")
    .doc(req.user.id)
    .get()
    .then((userDoc) => {
      if (userDoc.exists) {
        let user = userDoc.data();
        let obj = {
          name: user.name,
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
        label: `customer auth getUser ${req.user.id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.verifyOtp = async (req, res, next) => {
  await firestore
    .collection("users")
    .doc(req.user.id)
    .set(
      {
        verify_otp: true,
      },
      {
        merge: true,
      }
    )
    .then((user) => {
      res.status(200).json({
        success: true,
      });
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `customer auth verifyOtp ${req.user.id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.verifySession = async (req, res, next) => {
  let cookie = await extractCookie(req, res);
  try {
    let cookie = await extractCookie(req, res);
    if (!cookie) {
      return res.status(403).json({
        success: false,
        message: status.SCAN_QR,
      });
    }
    let user = req.user;
    if (user.blocked) {
      let bl = moment(user.blocked.split("-"));
      let curr = moment(
        moment()
          .utcOffset(process.env.UTC_OFFSET)
          .format("YYYY-MM-DD")
          .split("-")
      );
      let diff = curr.diff(bl, "days");

      if (diff <= 2) {
        return res.status(403).json({
          success: false,
          message: status.BLOCK,
        });
      }

      delete user.blocked;
      delete user.join;
    }

    if (req.user.join && req.user.join != cookie.rest_id) {
      return res.status(403).json({
        success: false,
        message: status.SESSION_EXIST_REST,
      });
    }

    let customersRef = await firestore
      .collection("restaurants")
      .doc(cookie.rest_id)
      .collection("customers")
      .doc("users");

    let take_menu;

    await firestore
      .runTransaction(async (t) => {
        let doc = await t.get(customersRef);
        let users = doc.data();
        let seatCust = users?.seat || [];
        let takeawayCust = users?.takeaway || [];
        take_menu = users?.take_menu;
        let total_tables = 0;
        if (cookie.type) {
          let index = users.type
            .map((e) => {
              return e.value;
            })
            .indexOf(cookie.type);
          total_tables = users.type[index].tables;
        } else {
          total_tables = users.tables;
        }
        let user = { id: req.user.id, name: req.user.name };
        let promise = await setCustomerOntable(
          seatCust,
          takeawayCust,
          total_tables,
          cookie,
          user
        );

        if (promise.success && !promise.status) {
          await t.set(
            customersRef,
            {
              seat: promise.seatCust,
              takeaway: promise.takeawayCust,
            },
            { merge: true }
          );
        }
        return Promise.resolve(promise);
      })
      .then(async (promise) => {
        if (promise.success && promise.status == 200) {
          return res.status(200).json({ success: true });
        } else if (!promise.success) {
          return res
            .status(promise.status)
            .json({ success: false, message: promise.message });
        }

        if (cookie.table != "takeaway") {
          await firestore
            .collection("users")
            .doc(req.user.id)
            .set({ join: cookie.rest_id }, { merge: true });
        }

        if (cookie.table == "takeaway") {
          return res.status(200).json({
            success: true,
            request: true,
            take_menu: take_menu,
            message: status.REQUEST_SENT,
          });
        }
        return res.status(200).json({
          success: true,
        });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `customer auth verifySession ${cookie.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

function setCustomerOntable(
  seatCust,
  takeawayCust,
  total_tables,
  cookie,
  user
) {
  if (cookie.table == "takeaway") {
    let index = 0;
    let flag = 0;
    for (let user of seatCust) {
      if (user.cid == user.id) {
        if (user.restore) {
          flag = 1;
          break;
        } else {
          return { status: 403, success: false, message: status.OCCUPIED };
        }
      }
      index++;
    }

    if (flag) {
      seatCust.splice(index, 1);
    }

    if (takeawayCust.length != 0) {
      index = 0;
      flag = 0;
      for (let ele of takeawayCust) {
        if (ele.cid == user.id) {
          if (ele.restore) {
            flag = 1;
            break;
          }
          if (ele.checkout) {
            return { status: 403, success: false, message: status.CHECKOUTED };
          }
          return { status: 200, success: true };
        }
        index++;
      }

      if (flag) {
        delete takeawayCust[index].restore;
        delete takeawayCust[index].req;
      } else {
        takeawayCust.push({
          table: cookie.table,
          cid: user.id,
          cname: user.name,
          checkout: false,
        });
      }
    } else {
      let obj = {
        table: cookie.table,
        cid: user.id,
        cname: user.name,
        checkout: false,
      };
      takeawayCust = [{ ...obj }];
    }
  } else {
    let index = 0;
    let flag = 0;

    for (let user of takeawayCust) {
      if (user.cid == user.id) {
        if (user.restore || !user.req) {
          flag = 1;
          break;
        } else {
          return {
            status: 403,
            success: false,
            message: status.ALREADY_SCAN_TAKEAWAY,
          };
        }
      }
      index++;
    }

    if (flag) {
      takeawayCust.splice(index, 1);
    }

    if (seatCust.length != 0) {
      if (Number(cookie.table) > Number(total_tables)) {
        return { status: 403, success: false, message: status.SCAN_QR };
      }

      index = 0;
      flag = 0;
      restCust = false;

      let tempIndex = seatCust.findIndex(
        (ele) =>
          ele.cid == user.id &&
          ele.restore &&
          (Number(ele.table) != Number(cookie.table) ||
            (ele.type ? ele.type != cookie.type : false))
      );

      if (tempIndex != -1) {
        seatCust.splice(tempIndex, 1);
      }

      for (let ele of seatCust) {
        if (ele.cid == user.id) {
          if (ele.restore) {
            flag = 1;
            break;
          }
          if (
            Number(ele.table) == Number(cookie.table) &&
            ele.checkout == false
          ) {
            return { status: 200, success: true };
          } else {
            return { status: 403, success: false, message: status.OCCUPIED };
          }
        } else if (Number(ele.table) == Number(cookie.table)) {
          if (cookie.type) {
            if (cookie.type == ele.type) {
              if (ele.restore) {
                restCust = true;
                break;
              } else {
                return {
                  status: 403,
                  success: false,
                  message: status.SESSION_EXIST,
                };
              }
            }
          } else {
            if (!ele.restore) {
              return {
                status: 403,
                success: false,
                message: status.SESSION_EXIST,
              };
            } else {
              restCust = true;
              break;
            }
          }
        }
        index++;
      }

      if (flag) {
        let cust = {
          ...seatCust[index],
        };
        delete cust.restore;
        seatCust[index] = cust;
      } else if (restCust) {
        let cust = {};
        if (cookie.type) {
          cust = {
            table: cookie.table,
            cid: user.id,
            cname: user.name,
            checkout: false,
            type: cookie.type,
          };
        } else {
          cust = {
            table: cookie.table,
            cid: user.id,
            cname: user.name,
            checkout: false,
          };
        }
        seatCust[index] = cust;
      } else {
        if (cookie.type) {
          seatCust.push({
            table: cookie.table,
            cid: user.id,
            cname: user.name,
            checkout: false,
            type: cookie.type,
          });
        } else {
          seatCust.push({
            table: cookie.table,
            cid: user.id,
            cname: user.name,
            checkout: false,
          });
        }
      }
    } else {
      let obj = {};

      if (cookie.type) {
        obj = {
          table: cookie.table,
          cid: user.id,
          cname: user.name,
          checkout: false,
          type: cookie.type,
        };
      } else {
        obj = {
          table: cookie.table,
          cid: user.id,
          cname: user.name,
          checkout: false,
        };
      }
      seatCust = [{ ...obj }];
    }
  }
  return { success: true, seatCust, takeawayCust };
}

exports.forgotPasswordCheckMail = async (req, res) => {
  try {
    let email = req.body.email;
    console.log(req.body);
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let usersRef = firestore.collection("users");
    let user = await usersRef.where("email", "==", email).limit(1).get();

    if (user.empty || user.docs[0].data().provider) {
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
      text: `Your verification code for forgot password is ${code}`,
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
            throw err;
          }
        );
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `customer auth forgotPasswordCheckMail ${req.user.id}`,
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

    let usersRef = firestore.collection("users");
    let user = await usersRef.where("email", "==", data.email).limit(1).get();

    if (user.empty || user.docs[0].data().provider) {
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
      label: `customer auth  checkVerificationCodeForForgotPass ${req.user.id}`,
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

    let usersRef = firestore.collection("users");
    let user = await usersRef.where("email", "==", email).get();

    if (user.empty || user.docs[0].data().provider) {
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
      label: `customer auth  changePassword ${req.user.id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getLogoUrl = async (req, res) => {
  let cookie = await extractCookie(req, res);
  console.log(cookie);
  if (!cookie.rest_id) {
    return res.status(400);
  } else {
    let restDoc = await firestore
      .collection("restaurants")
      .doc(cookie.rest_id)
      .get();

    let data = restDoc.data();
    console.log(data.logo);
    return res.status(200).json({ success: true, logo: data.logo || "" });
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
    length: 6,
    charset: "numeric",
  });
}
