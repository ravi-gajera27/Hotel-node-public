const firestore = require('firebase-admin').firestore()
const status = require('../../utils/status')
const HASH = require('../../utils/encryption')
const TOKEN = require('../../utils/token')
const sgMail = require('@sendgrid/mail')
const randomstring = require('randomstring')
const logger = require('../../config/logger')
const { extractErrorMessage } = require('../../utils/error')
const { incZoneReq } = require('../../utils/zone')

exports.login = async (req, res, next) => {
  try {
    let data = req.body

    if (!data.email || !data.password) {
      await incZoneReq(req.ip, 'login')
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    let usersRef = firestore.collection('captain')
    let user = await usersRef.where('email', '==', data.email).limit(1).get()

    if (user.empty) {
      await incZoneReq(req.ip, 'login')
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_EMAIL })
    }

    let password, id, rest_id

    user.docs.forEach((doc) => {
      password = doc.data().password
      id = doc.id
      rest_id = doc.data().rest_id
    })

    console.log(await HASH.generateHash('ravi1234',10))
    let verifyPassword = await HASH.verifyHash(data.password, password)

    if (!verifyPassword) {
      await incZoneReq(req.ip, 'login')
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_PASS })
    } else {
        await sendToken({ user_id: id, rest_id: rest_id }, res)
    }
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `captain auth login ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.getTables = async(req, res) => {
  firestore
  .collection('restaurants')
  .doc(req.user.rest_id)
  .get()
  .then((rest_details) => { 
    let data = rest_details.data()
    res.status(200).json({
      success: true,
      data: {tables: data.tables},
    })
  }) .catch((err) => {
    let e = extractErrorMessage(err)
    logger.error({
      label: `captain auth getTables ${req.user.id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  })
}

exports.getUser = async (req, res, next) => {
  firestore
    .collection('captain')
    .doc(req.user.id)
    .get()
    .then((userDoc) => {
      if (userDoc.exists) {
        let user = userDoc.data()
        let obj = {
          name: user.f_name + ' ' + user.l_name,
          email: user.email,
          mobile_no: user.mobile_no,
          id: userDoc.id,
        }
        res.status(200).json({
          success: true,
          data: obj,
        })
      }
    })
    .catch((err) => {
      let e = extractErrorMessage(err)
      logger.error({
        label: `captain auth getUser ${req.user.id}`,
        message: e,
      })
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR })
    })
}

exports.forgotPasswordCheckMail = async (req, res) => {
  try {
    let email = req.body.email
    console.log(req.body)
    if (!email) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    let captainRef = firestore.collection('captain')
    let captain = await captainRef.where('email', '==', email).limit(1).get()

    if (captain.empty) {
      return res
        .status(400)
        .json({ success: false, message: status.INVALID_EMAIL })
    }

    let captain_id = captain.docs[0].id

    let code = await generateRandomString()

    const msg = {
      to: email, // Change to your recipient
      from: 'peraket.dev@gmail.com', // Change to your verified sender
      subject: 'Verification Code',
      text: `Your verification code for forgot password is ${code}`,
    }
    sgMail.send(msg).then(() => {
      captainRef
        .doc(captain_id)
        .set({ ver_code: code }, { merge: true })
        .then(
          (e) => {
            return res.status(200).json({
              success: true,
              message: 'We have sent verification code on you registered email',
            })
          },
          (err) => {
            throw err
          },
        )
    })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `captain auth forgotPasswordCheckMail ${req.user.id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.checkVerificationCodeForForgotPass = async (req, res) => {
  try {
    let data = req.body

    if (!data.email || !data.code) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    let captainRef = firestore.collection('captain')
    let captain = await usersRef.where('email', '==', data.email).limit(1).get()

    if (captain.empty) {
      return res
        .status(404)
        .json({ success: false, message: status.UNAUTHORIZED })
    }

    captain_id = captain.docs[0].id
    let tempuser
    captain.docs.forEach((e) => {
      tempuser = e.data()
    })

    if (tempuser.ver_code != data.code) {
      return res
        .status(400)
        .json({ success: false, message: 'Provide valid verification code' })
    }

    return res
      .status(200)
      .json({ success: true, message: 'Successfully verified' })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `captain auth  checkVerificationCodeForForgotPass ${req.user.id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.changePassword = async (req, res) => {
  try {
    let { email, new_pass, confirm_pass, code } = req.body
    if (!email || !new_pass || !confirm_pass || !code) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    if (new_pass != confirm_pass) {
      return res
        .status(400)
        .json({ success: false, message: status.PASSWORD_NOT_EQUAL })
    }

    let captainRef = firestore.collection('captain')
    let captain = await captainRef.where('email', '==', email).get()

    if (captain.empty) {
      return res
        .status(404)
        .json({ success: false, message: status.UNAUTHORIZED })
    }

    let tempuser
    captain.docs.forEach((e) => {
      tempuser = e.data()
    })

    captain_id = captain.docs[0].id

    if (tempuser.ver_code != code) {
      return res
        .status(404)
        .json({ success: false, message: status.UNAUTHORIZED })
    }

    tempuser.password = await HASH.generateHash(new_pass, 10)
    delete tempuser.ver_code

    usersRef
      .doc(captain_id)
      .set(tempuser)
      .then((e) => {
        return res.status(200).json({
          success: true,
          message: 'Your password is successfully changed',
        })
      })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `customer auth  changePassword ${req.user.id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

sendToken = async (data, res) => {
  let token = await TOKEN.generateToken(data)
  return res.status(200).json({
    success: true,
    token: token,
  })
}

async function generateRandomString() {
  return await randomstring.generate({
    length: 6,
    charset: 'numeric',
  })
}