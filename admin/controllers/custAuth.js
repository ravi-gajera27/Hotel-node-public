const firestore = require('../../config/db').firestore()
const status = require('../../utils/status')
const moment = require('moment')
const { extractErrorMessage } = require('../../utils/error')
const logger = require('../../config/logger')

exports.acceptRequest = async (req, res, next) => {
  try {
    let custoemrsRef = await firestore
      .collection('restaurants')
      .doc(req.user.rest_id)
      .collection('customers')
      .doc('users')

    let customers = (await custoemrsRef.get()).data().takeaway

    customers.map((cust) => {
      if (cust.cid == req.params.cid) {
        cust.req = true
      }
    })

    await custoemrsRef.set({ takeaway: [...customers] }, { merge: true })

    res
      .status(200)
      .json({ success: true, message: status.ACCEPT_REQUEST_ADMIN })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin custAuth acceptRequest ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.rejectRequest = async (req, res, next) => {
  try {
    let customersRef = await firestore
      .collection('restaurants')
      .doc(req.user.rest_id)
      .collection('customers')
      .doc('users')

    let customers = (await customersRef.get()).data().takeaway

    customers = customers.filter((cust) => cust.cid != req.params.cid)

    let userRef = await firestore.collection('users').doc(req.params.cid)

    await userRef.set({ join: '' }, { merge: true })

    await customersRef.set({ takeaway: [...customers] }, { merge: true })

    res
      .status(200)
      .json({ success: true, message: status.REJECT_REQUEST_ADMIN })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin custAuth rejectRequest ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.blockCustomer = async (req, res, next) => {
  try {
    let customersRef = await firestore
      .collection('restaurants')
      .doc(req.user.rest_id)
      .collection('customers')
      .doc('users')

    let customers = (await customersRef.get()).data().takeaway

    customers = customers.filter((cust) => cust.cid != req.params.cid)

    let userRef = await firestore.collection('users').doc(req.params.cid)

    let blocked = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .format('YYYY-MM-DD')

    await customersRef.set({ takeaway: [...customers] }, { merge: true })

    await userRef.set({ blocked: blocked, join: '' }, { merge: true })

    res
      .status(200)
      .json({ success: true, message: status.REJECT_REQUEST_ADMIN })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin custAuth blockCustomer ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.removeCustomer = async (req, res, next) => {
  try{
  let table_no = req.params.table_no
  let cid = req.params.cid

  if (!table_no || !cid) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }

  let orderRef
  let orderCollectionRef
  let customersRef = await firestore
    .collection(`restaurants`)
    .doc(req.user.rest_id)
    .collection('customers')
    .doc('users')

  let customers

  if (table_no == 'takeaway') {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`)

    customers = (await customersRef.get()).data().takeaway || []
  } else {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`)

    customers = (await customersRef.get()).data().seat || []
  }

  let order = await orderRef.get()

  let newCustomers = []

  for (let cust of customers) {
    if (cust.restore) {
      continue
    }
    if (cust.table == table_no && cust.cid == cid) {
      cust.restore = true
    }
    newCustomers.push(cust)
  }

  if (table_no == 'takeaway') {
    await customersRef.set(
      {
        takeaway: newCustomers,
      },
      { merge: true },
    )
  } else {
    await customersRef.set(
      {
        seat: newCustomers,
      },
      { merge: true },
    )
  }

  if (order.exists) {
    await orderRef
      .set({ restore: true }, { merge: true })
      .then(async (e) => {
        await firestore
          .collection('users')
          .doc(`${cid}`)
          .set({ join: '' }, { merge: true })

        return res.status(200).json({
          success: true,
          message: `Sessoin from table-${table_no} is successfully terminated`,
        })
      })
  } else {
    await firestore
      .collection('users')
      .doc(`${cid}`)
      .set({ join: '' }, { merge: true })

    return res.status(200).json({
      success: true,
      message: `Sessoin from table-${table_no} is successfully terminated`,
    })
  }
}catch (err) {
  let e = extractErrorMessage(err)
  logger.error({
    label: `admin custAuth removeCustomer ${req.user.rest_id}`,
    message: e,
  })
  return res
    .status(500)
    .json({ success: false, message: status.SERVER_ERROR })
}
}

exports.restoreCustomer = async (req, res, next) => {
  try{
  let table_no = req.params.table_no
  let cid = req.params.cid

  if (!table_no || !cid) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }

  let customersRef = await firestore
    .collection('restaurants')
    .doc(req.user.rest_id)
    .collection('customers')
    .doc('users')

  let customers
  let orderRef

  if (table_no == 'takeaway') {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`)

    customers = (await customersRef.get()).data().takeaway || []
  } else {
    customers = (await customersRef.get()).data().seat || []

    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`)
  }

  let index = customers.findIndex((ele) => {
    return cid == ele.cid && ele.table == table_no
  })

  if (index == -1) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }

  let order = await orderRef.get()
  if (order.exists && order.data().cid == cid) {
    await orderRef.set({ restore: false }, { merge: true })
  }

  delete customers[index].restore

  if (table_no == 'takeaway') {
    await customersRef
      .set({ takeaway: [...customers] }, { merge: true })
      .then(async (e) => {
        await firestore
          .collection('users')
          .doc(`${cid}`)
          .set({ join: req.user.rest_id }, { merge: true })

        res.status(200).json({ success: true, message: status.RESTORED })
      })
      .catch((err) => {
        res.status(404).json({ success: false, message: status.SERVER_ERROR })
      })
  } else {
    await customersRef
      .set({ seat: [...customers] }, { merge: true })
      .then(async (e) => {
        await firestore
          .collection('users')
          .doc(`${cid}`)
          .set({ join: req.user.rest_id }, { merge: true })

        res.status(200).json({ success: true, message: status.RESTORED })
      })
  }
}catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin custAuth restoreCustomer ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.checkoutCustomer = async (req, res, next) => {
  try{
  let table_no = req.params.table_no
  let cid = req.params.cid

  if (!table_no || !cid) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }

  let customerRef = firestore
    .collection(`restaurants/${req.user.rest_id}/customers`)
    .doc('users')

  let customers = await customerRef.get()
  let seatCust = customers.data()?.seat || []
  let takeawayCust = customers.data()?.takeaway || []

  let orderRef
  if (table_no == 'takeaway') {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .doc(`${cid}`)
  } else {
    orderRef = firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .doc(`table-${table_no}`)
  }

  let orderDoc = await orderRef.get()
  let orderData = orderDoc.data()

  if (!orderDoc.exists || !orderData.cid || orderData.order.length == 0) {
    return res
      .status(403)
      .json({ success: false, message: 'Customer is not ordered yet' })
  }

  if (orderData.cid != cid) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }

  let finalInvoice = { data: [] }

  if (orderData.restore || orderData.cancel) {
    return res.status(403).json({
      success: false,
      message: 'Order of this customer is already canceld',
    })
  }

  for (let ele of orderData.order) {
    if (ele.restore || ele.cancel) {
      continue
    }
    let order = { ...ele }

    if (finalInvoice.data.length != 0) {
      finalInvoice.taxable += order.taxable
      finalInvoice.qty += order.qty
      let index = finalInvoice.data.length
      for (let i = 0; i < order.data.length; i++) {
        let flag = true
        for (let j = 0; j < index; j++) {
          if (
            order.data[i].name == finalInvoice.data[j].name &&
            order.data[i].type == finalInvoice.data[j].type &&
            order.data[i].addon.length == finalInvoice.data[j].addon.length
          ) {
            let check = order.data[i].addon.every(
              (el) => finalInvoice.data[j].addon.indexOf(el) >= 0,
            )
            if (check == true) {
              finalInvoice.data[j].qty += order.data[i].qty
              finalInvoice.data[j].price += order.data[i].price
              flag = false
              break
            }
          }
        }
        if (flag) {
          finalInvoice.data.push(order.data[i])
        }
      }
    } else {
      delete order.id
      delete order.inst
      finalInvoice = JSON.parse(JSON.stringify(order))
    }

    if (res.unique) {
      finalInvoice.unique = true
    }
  }

  let restRef = await firestore.collection('restaurants').doc(req.user.rest_id)

  let rest_details = await restRef.get()

  let restData = rest_details.data()
  restData = await setInvoiceNumber(restData)
  if(!restData){
    return res
    .status(500)
    .json({ success: false, message: status.SERVER_ERROR })
  }

  finalInvoice.cid = cid
  finalInvoice.cname = orderData.cname
  finalInvoice.table = table_no
  finalInvoice.inv_no = restData.inv_no
  finalInvoice.clean = false
  delete finalInvoice.date
  delete finalInvoice.qty
  finalInvoice.inv_date = moment()
    .utcOffset(process.env.UTC_OFFSET)
    .format('YYYY-MM-DD')
  finalInvoice.time = moment().utcOffset(process.env.UTC_OFFSET).format('HH:mm')
  finalInvoice.tax = Number(restData.tax)

  if (restData.taxInc) {
    finalInvoice.total_amt = finalInvoice.taxable
    finalInvoice.taxable = (finalInvoice.taxable * 100) / (100 + restData.tax)
    finalInvoice.taxInc = true
  } else {
    finalInvoice.total_amt =
      finalInvoice.taxable + (finalInvoice.taxable * restData.tax) / 100
  }

  let inv = restData.inv
  let date = moment().utcOffset(process.env.UTC_OFFSET).format('YYYY-MM-DD')

  if (!inv || inv.date != date) {
    inv = { date: date, docId: date }
  }

  let invoiceRef = firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .doc(inv.docId)

  let invoiceDoc = await invoiceRef.get()

  let invoiceData
  if (invoiceDoc.exists) {
    let invoices = invoiceDoc.data().invoices
    if (invoices.length >= 130) {
      let split = inv.docId.split('_')
      console.log(split, split.length)
      if (split.length == 2) {
        inv.docId = split[0] + '_' + (Number(split[1]) + 1)
      } else {
        inv.docId = inv.docId + '_1'
      }
      invoiceData = { inv_date: date, invoices: [{ ...finalInvoice }] }
    } else {
      invoices.push({ ...finalInvoice })
      invoiceData = { invoices: [...invoices] }
    }
  } else {
    invoiceData = { inv_date: date, invoices: [{ ...finalInvoice }] }
  }

  let index
  if (table_no == 'takeaway') {
    index = takeawayCust.findIndex(
      (ele) =>
        ele.cid == cid && ele.table == table_no && ele.cname == orderData.cname,
    )
    let obj = { ...takeawayCust[index] }

    obj.checkout = true
    obj.inv_no = restData.inv_no
    obj.inv_id = inv.docId
    delete obj.req

    takeawayCust[index] = obj
  } else {
    index = seatCust.findIndex(
      (ele) =>
        ele.cid == cid && ele.table == table_no && ele.cname == orderData.cname,
    )
    seatCust[index].checkout = true
    seatCust[index].inv_no = restData.inv_no
    seatCust[index].inv_id = inv.docId
  }

  invoiceRef = firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .doc(inv.docId)

  restData.inv = inv
  invoiceRef
    .set(invoiceData, { merge: true })
    .then(async (e) => {
      await orderRef.delete()

      await customerRef.set(
        { seat: [...seatCust], takeaway: [...takeawayCust] },
        { merge: true },
      )
      await restRef.set(restData, { merge: true })
      return res
        .status(200)
        .json({ success: true, message: 'Successfully checkout' })
    })
  }catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin custAuth checkoutCustomer ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.updateInvoice = async (req, res) => {
  try{
  let invoice = req.body
  let inv_id = req.params.inv_id

  if (!inv_id) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }

  delete invoice.order_no

  let invoiceRef = firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .doc(inv_id)

  let invoiceDoc = await invoiceRef.get()

  let invoices = invoiceDoc.data().invoices

  let index = invoices
    .map((e) => {
      return e.inv_no
    })
    .indexOf(invoice.inv_no)

  if (index == -1) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }
  invoices[index] = invoice

  await invoiceRef
    .set({ invoices: [...invoices] }, { merge: true })
    .then((e) => {
      return res
        .status(200)
        .json({ success: true, message: 'Successfully Changed' })
    })
  }
  catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin custAuth updateInvoice ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.cleanUpCustomers = async (req, res) => {
  try{
  let invoice = req.body
  let inv_id = req.params.inv_id
  invoice.inv_id = inv_id

  if (!invoice.cid || !invoice.table || !inv_id) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }

  let customerRef = firestore
    .collection(`restaurants/${req.user.rest_id}/customers`)
    .doc('users')

  let customers = await customerRef.get()

  if (!customers.exists) {
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }

  let seatCust = customers.data()?.seat || []
  let takeawayCust = customers.data()?.takeaway || []

  if (invoice.table == 'takeaway') {
    takeawayCust = takeawayCust.filter(
      (ele) => ele.cid != invoice.cid && ele.table != invoice.table,
    )
  } else {
    seatCust = seatCust.filter(
      (ele) => ele.cid != invoice.cid && ele.table != invoice.table,
    )
  }

  delete invoice.order_no
  delete invoice.clean

  let invoiceRef = firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .doc(inv_id)

  let invoiceDoc = await invoiceRef.get()

  let invoices = invoiceDoc.data().invoices

  let index = invoices
    .map((e) => {
      return e.inv_no
    })
    .indexOf(invoice.inv_no)

  if (index == -1) {
    console.log('bad index')
    return res.status(400).json({ success: false, message: status.BAD_REQUEST })
  }
  invoices[index] = invoice

  await invoiceRef
    .set({ invoices: [...invoices] }, { merge: true })
    .then(async (e) => {
      await customerRef.set(
        { seat: [...seatCust], takeaway: [...takeawayCust] },
        { merge: true },
      )
      await firestore
        .collection('users')
        .doc(invoice.cid)
        .set({ join: '' }, { merge: true })
      return res
        .status(200)
        .json({ success: true, message: 'Successfully Cleaned up' })
    })
  }catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin custAuth cleanUpCustomer ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

function setInvoiceNumber(data) {
  try{
  let invoice_format = data.invoice_format
  let set_invoice_no = ''

  if (!invoice_format.curr_num) {
    set_invoice_no =
      invoice_format.start_text +
      invoice_format.middle_symbol +
      (invoice_format.year
        ? moment()
            .utcOffset(process.env.UTC_OFFSET)
            .year()
            .toString()
            .substr(-2) + invoice_format.middle_symbol
        : '') +
      invoice_format.start_num
    data.invoice_format.curr_num = invoice_format.start_num
  } else {
    let current_month = moment().utcOffset(process.env.UTC_OFFSET).month()
    let fan_year
    if (current_month < 3) {
      fan_year =
        moment()
          .utcOffset(process.env.UTC_OFFSET)
          .subtract(1, 'year')
          .format('YYYY')
          .substr(-2) +
        '-' +
        moment().utcOffset(process.env.UTC_OFFSET).format('YYYY').substr(-2)
    } else {
      fan_year =
        moment().utcOffset(process.env.UTC_OFFSET).format('YYYY').substr(-2) +
        '-' +
        moment()
          .utcOffset(process.env.UTC_OFFSET)
          .add(1, 'year')
          .format('YYYY')
          .substr(-2)
    }
    if (fan_year != invoice_format.fan_year) {
      invoice_format.fan_year =
        moment().utcOffset(process.env.UTC_OFFSET).format('YYYY').substr(-2) +
        '-' +
        moment()
          .utcOffset(process.env.UTC_OFFSET)
          .add(1, 'year')
          .format('YYYY')
          .substr(-2)
      data.invoice_format.curr_num = invoice_format.start_num
      set_invoice_no =
        invoice_format.start_text +
        invoice_format.middle_symbol +
        (invoice_format.year
          ? moment()
              .utcOffset(process.env.UTC_OFFSET)
              .year()
              .toString()
              .substr(-2) + invoice_format.middle_symbol
          : '') +
        invoice_format.start_num
    }
  }

  let curr_num = invoice_format.curr_num
  if (!set_invoice_no) {
    let n1 = curr_num.toString()
    let n2 = (parseInt(curr_num) + 1).toString()
    let l1 = n1.length
    let l2 = n2.length
    if (l1 > l2) {
      n2 = n1.substr(0, l1 - l2) + n2
    }

    set_invoice_no =
      invoice_format.start_text +
      invoice_format.middle_symbol +
      (invoice_format.year
        ? moment()
            .utcOffset(process.env.UTC_OFFSET)
            .year()
            .toString()
            .substr(-2) + invoice_format.middle_symbol
        : '') +
      n2

    data.invoice_format.curr_num = n2
  }

  data.inv_no = set_invoice_no

  return data
}catch (err) {
  let e = extractErrorMessage(err)
  logger.error({
    label: `admin custAuth setInvoiceNumber ${req.user.rest_id}`,
    message: e,
  })
   return null
}
}
