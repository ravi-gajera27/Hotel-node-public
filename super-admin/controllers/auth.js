const firestore = require('firebase-admin').firestore()
const status = require('../../utils/status')
const HASH = require('../../utils/encryption')
const TOKEN = require('../../utils/token')
const moment = require('moment')
const sgMail = require('@sendgrid/mail')
const randomstring = require('randomstring')
const { extractErrorMessage }=require('../../utils/error')
const logger=require('../../config/logger')
const { incZoneReq } = require('../../utils/zone')
sgMail.setApiKey(process.env.FORGOT_PASS_API_KEY)

exports.login = async (req, res, next) => {
  try {
    let data = req.body

    if (!data.email || !data.password) {
      await incZoneReq(req.ip, 'login')
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    let usersRef = firestore.collection('super-admin')
    let user = await usersRef.where('email', '==', data.email).limit(1).get()

    if (user.empty) {
      await incZoneReq(req.ip, 'login')
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_EMAIL })
    }

    let password
    let id

    user.forEach((doc) => {
      password = doc.data().password
      id = doc.id
    })
   

    let verifyPassword = await HASH.verifyHash(data.password, password)

    if (!verifyPassword) {
      await incZoneReq(req.ip, 'login')
      return res
        .status(401)
        .json({ success: false, message: status.INVALID_PASS })
    } else {
        await sendToken({ user_id: id }, res)
    }
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `super-admin auth login`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

sendToken = async (data, res) => {
  console.log(data)
  let token = await TOKEN.generateToken(data)
  return res.status(200).json({ success: true, token: token })
}

async function generateRandomString() {
  return await randomstring.generate({
    length: 6,
    charset: 'numeric',
  })
}
