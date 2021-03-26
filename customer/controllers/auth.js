const firstore = require('../../config/db').firestore()
const status = require('../../utils/status');
const HASH = require('../../utils/encryption');
const TOKEN = require('../../utils/token');
const { extractCookie } = require('../../utils/cookie-parser');

exports.login = async (req, res, next) => {
  let data = req.body;

  if (!data.email || !data.password) {
    return res.status(400).json({ success: false, err: status.BAD_REQUEST });
  }

  let usersRef = firstore.collection('users');
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
  console.log(data)
  if (
    !data.email ||
    !data.password ||
    !data.name ||
    !data.mobile_no
  ) {
    return res.status(400).json({ success: false, err: status.BAD_REQUEST });
  }

  let usersRef = firstore.collection('users');
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
  user = await firstore.collection('users').add({ ...data });
  await sendToken({ user_id: user.id }, res);
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
    .collection('users')
    .doc(req.user.id)
    .set({ verify_otp: true }, { merge: true })
    .then((user) => {
      res.status(200).json({ success: true });
    })
    .catch((err) => {
      return res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.verifySession = async (req, res, next) => {
  console.log(req.body);
  let cookie = await extractCookie(req, res);

  if (!cookie) {
    return res.status(403).json({ success: false, err: status.UNAUTHORIZED });
  }

  let customersRef = await firstore
    .collection(`restaurants`).doc(cookie.rest_id)


  let data = await customersRef.get()
 if(!data.exists){
  return res.status(403).json({ success: false, err: status.UNAUTHORIZED });
 }
  data = data.data()


  if (data.customers && data.customers.length != 0) {

    let customers = data.customers

    if (Number(cookie.table) > Number(data.total_tables)) {
      return res.status(403).json({ success: false, err: status.UNAUTHORIZED });
    }

    for (ele of customers) {
      if (ele.user_id == req.user.id) {
        if (Number(ele.table) == Number(cookie.table)) {
          return res.status(200).json({ success: true })
        }
        else {
          return res.status(403).json({ success: false, err: status.FORBIDDEN })
        }
      }
      else if (Number(ele.table) == Number(cookie.table)) {
        return res.status(403).json({ success: false, err: status.SESSION_EXIST })
      }
    }

    customers.push({ table: Number(cookie.table), user_id: req.user.id, customer_name: req.user.name })

    await customersRef.set({ customers: [...customers] }, { merge: true });

   return res.status(200).json({ success: true });

  } else {
    let obj = {
      table: Number(cookie.table),
      user_id: req.user.id,
      customer_name: req.user.name
    }

    await customersRef.set({ customers: [{ ...obj }] }, { merge: true })
    return res.status(200).json({ success: true });
  }

  
};

sendToken = async (data, res) => {
  let token = await TOKEN.generateToken(data);
  return res.status(200).json({ success: true, token: token });
};
