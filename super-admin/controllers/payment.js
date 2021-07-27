const firestore = require('firebase-admin').firestore()
const status = require('../../utils/status')
const HASH = require('../../utils/encryption')
const TOKEN = require('../../utils/token')
const moment = require('moment')
const sgMail = require('@sendgrid/mail')
const { extractErrorMessage }=require('../../utils/error')
const logger=require('../../config/logger')
sgMail.setApiKey(process.env.FORGOT_PASS_API_KEY)

exports.generateInvoiceAPI = async (req, res) => {
  try {
    let success = await this.generateInvoice()
    if (success == true) {
      res.status(200).json({ success: true, message: status.INVOICE_GEN })
    }
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `super-admin payment generateInvoiceAPI ${req.user.id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.generateInvoiceByRestId = async (req, res) => {
  let rest_id = req.params.rest_id
  try {
    if (!rest_id) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    let invoiceDoc = await firestore
      .collection(`orders/${rest_id}/invoices`)
      .where('inv_date', '>=', start_date)
      .where('inv_date', '<=', end_date)
      .get()

    if (invoiceDoc.empty) {
      return res.status(200).json({
        success: true,
        message: 'Either invalid restaurant or document is empty',
      })
    }

    let restDoc = await firestore.collection(`restaurants`).doc(rest_id).get()

    let rest_deatails = restDoc.data()

    let earning = 0
    for (let doc of invoiceDoc.docs) {
      let data = doc.data()

      for (let invoice of data.invoices) {
        earning += invoice.total_amt
      }
    }
    let date = moment().utcOffset(process.env.UTC_OFFSET).format('DD-MM-YYYY')
    earning = Math.round(earning)

    let obj = {
      payment: earning,
      date: date,
      rest_name: rest_details.name,
      city: rest_deatails.city,
      state: rest_deatails.state,
    }
    await firestore
      .collection('paymentReq')
      .doc(rest_id)
      .set({ ...obj })
      .then((e) => {
        res.status(200).json({ success: true, message: status.INVOICE_GEN })
      })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `super-admin payment generateInvoiceByRestId user: ${req.user.id} rest: ${rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.restaurantLockedAPI = async (req, res) => {
  try {
    let success = await this.lockedRestaurant()
    if (success == true) {
      res.status(200).json({ success: true, message: status.INVOICE_GEN })
    } 
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `super-admin payment restaurantLockedAPI ${req.user.id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.restaurantLockedByRestId = async (req, res) => {
  let rest_id = req.params.rest_id
  try {
    if (!rest_id) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    await firestore
      .collection('restaurants')
      .doc(rest_id)
      .set({ locked: true }, { merge: true })
      .then((e) => {
        res.status(200).json({ success: true, message: status.LOCKED_REST })
      })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `super-admin payment restaurantLockedByRestId  user: ${req.user.id} rest: ${rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.generateInvoice = async () => {
  try {
    let collection = await firestore
      .collection('restaurants')
      .where('locked', '!='.true)
      .get()
    let start_date = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .subtract('1', 'month')
      .startOf('month')
      .format('YYYY-MM-DD')
    let end_date = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .subtract('1', 'month')
      .endOf('month')
      .format('YYYY-MM-DD')

    for (let rest of collection.docs) {
      let rest_id = rest.id
      let rest_details = rest.data()

      let invoiceDoc = await firestore
        .collection(`orders/${rest_id}/invoices`)
        .where('inv_date', '>=', start_date)
        .where('inv_date', '<=', end_date)
        .get()

      let earning = 0
      for (let doc of invoiceDoc.docs) {
        let data = doc.data()

        for (let invoice of data.invoices) {
          earning += invoice.total_amt
        }
      }
      earning = Math.round(earning)
      let date = moment().utcOffset(process.env.UTC_OFFSET).format('DD-MM-YYYY')
      let obj = {
        payment: earning,
        date: date,
        rest_name: rest_details.name,
        city: rest_deatails.city,
        state: rest_deatails.state,
      }

      await firestore
        .collection('paymentReq')
        .doc(rest_id)
        .set({ ...obj })
    }
    let invoice = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .format('DD MMM, YYYY hh:mm A')

    await firestore
      .collection('super-admin')
      .doc('general')
      .set({ invoice: invoice }, { merge: true })

    return true
  } catch (err) {
    throw err
  }
}

exports.lockedRestaurant = async () => {
  try {
    let paymentReqDoc = await firestore.collection('paymentReq').get()

    for (let rest of paymentReqDoc.docs) {
      let rest_id = rest.id
      await firestore
        .collection('restaurants')
        .doc(rest_id)
        .set({ locked: true }, { merge: true })
    }

    let locked = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .format('DD MMM, YYYY hh:mm A')

    await firestore
      .collection('super-admin')
      .doc('general')
      .set({ locked: locked }, { merge: true })
    return true
  } catch (err) {
   throw err
  }
}

exports.getRestaurantsWithoutPayment = async (req, res) => {
  let paymentReqDoc = await firestore.collection('paymentReq').get()
  let restaurants = []

  for (let req of paymentReqDoc.docs) {
    restaurants.push(req.data())
  }

  res.status(200).json({ success: true, data: restaurants })
}
