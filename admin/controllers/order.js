const firestore = require('../../config/db').firestore()
const status = require('../../utils/status')
const { extractErrorMessage }=require('../../utils/error')
const logger=require('../../config/logger')
exports.cancelOrder = async (req, res, next) => {
  try {
    let table_no = req.params.table_no
    let order_id = req.params.order_id
    let cid = req.params.cid
    let restoreOrder = req.body?.restoreOrder

    if (!table_no || !order_id || !cid) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }

    let orderRef
    let restoreOrderRef
    if (table_no == 'takeaway') {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/torder`)
        .doc(`${cid}`)

      if (
        restoreOrder.table_no &&
        restoreOrder.order_id &&
        restoreOrder.table_no != cid
      ) {
        restoreOrderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/torder`)
          .doc(`${restoreOrder.table_no}`)
      }
    } else {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`table-${table_no}`)

      if (
        restoreOrder.table_no &&
        restoreOrder.order_id &&
        restoreOrder.table_no != table_no
      ) {
        restoreOrderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`table-${restoreOrder.table_no}`)
      }
    }

    let orderData = await orderRef.get()
    let order_no

    if (orderData.exists) {
      let order = JSON.parse(JSON.stringify(orderData.data().order))
      order_no = getOrderNo(order, order_id)
      if (order_no == -1) {
        return res
          .status(400)
          .json({ status: false, message: status.BAD_REQUEST })
      }
      if (Number(order_no) <= order.length) {
        order.map((e) => {
          if (e.restore) {
            delete e.restore
            e.cancel = true
          }
        })
        order[Number(order_no)].restore = true

        let previousOrder
        if (restoreOrderRef) {
          let restoreOrderDoc = await restoreOrderRef.get()
          if (!restoreOrderDoc.exists) {
            return res
              .status(400)
              .json({ status: false, message: status.BAD_REQUEST })
          }

          let order = restoreOrderDoc.data().order

          let index = order
            .map((e) => {
              return e.id
            })
            .indexOf(restoreOrder.order_id)
          if (index != -1) {
            delete order[index].restore
            order[index].cancel = true
            previousOrder = order
          }
        }
        orderRef.set({ order: order }, { merge: true }).then(async (order) => {
          if (previousOrder) {
            await restoreOrderRef.set({ order: previousOrder }, { merge: true })
          }
          return res.status(200).json({
            success: true,
            message: `Order-${Number(order_no + 1)} from ${
              table_no == 'takeaway' ? 'Takeaway' : 'Table-' + table_no
            } is successfully cancelled`,
          })
        })
      } else {
        return res
          .status(400)
          .json({ status: false, message: status.BAD_REQUEST })
      }
    } else {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin order cancelOrder ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.restoreOrder = async (req, res, next) => {
  try {
    let table_no = req.params.table_no
    let order_id = req.params.order_id
    let cid = req.params.cid

    if (!table_no || !order_id || !cid) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }

    let orderRef
    let order_no
    if (table_no == 'takeaway') {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/torder`)
        .doc(`${cid}`)
    } else {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`table-${table_no}`)
    }

    let orderData = await orderRef.get()
    if (orderData.exists) {
      let order = JSON.parse(JSON.stringify(orderData.data().order))
      order_no = getOrderNo(order, order_id)
      if (order_no == -1) {
        return res
          .status(400)
          .json({ status: false, message: status.BAD_REQUEST })
      }
      if (Number(order_no) <= order.length) {
        delete order[Number(order_no)].restore

        orderRef.set({ order: order }, { merge: true }).then((order) => {
          return res.status(200).json({
            success: true,
            message: `Order-${Number(order_no + 1)} from ${
              table_no == 'takeaway' ? 'Takeaway' : 'Table-' + table_no
            } is successfully restored`,
          })
        })
      } else {
        return res
          .status(400)
          .json({ status: false, message: status.BAD_REQUEST })
      }
    } else {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin order restoreOrder ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.generateInvoice = async (req, res, next) => {
  try {
    let inv_no = req.body.inv_no
    let inv_id = req.body.inv_id

    if (!inv_no || !inv_id) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }
    let invoiceRef = await firestore
      .collection('orders')
      .doc(req.user.rest_id)
      .collection('invoices')
      .doc(inv_id)
      .get()

    if (!invoiceRef.exists) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }

    let rest_ref = await firestore
      .collection('restaurants')
      .doc(req.user.rest_id)
      .get()

    rest_ref = rest_ref.data()

    let rest_details = {
      rest_name: rest_ref.rest_name,
      rest_address: rest_ref.address,
      gst_in: rest_ref.gst_in || '',
    }
    let invoices = invoiceRef.data().invoices
    let index = invoices
      .map((e) => {
        return e.inv_no
      })
      .indexOf(inv_no)
    if (index == -1) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }

    res.status(200).json({
      success: true,
      data: { invoice: invoices[index], rest_details: rest_details },
    })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin order generateInvoice ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.getOrderByOrderId = async (req, res, next) => {
  try {
    let table_no = req.params.table_no
    let order_id = req.params.order_id
    let cid = req.params.cid

    if (!table_no || !order_id || !cid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

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

    let orderData = await orderRef.get()
    if (!orderData.exists) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    let order = orderData.data().order

    let order_no = getOrderNo(order, order_id)

    if (order_no == -1) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }

    if (order.length <= Number(order_no)) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    return res.status(200).json({ success: true, data: order[order_no] })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin order getOrderById ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

exports.setOrderByOrderId = async (req, res, next) => {
  try {
    let table_no = req.params.table_no
    let order_id = req.params.order_id
    let cid = req.params.cid

    if (!table_no || !order_id || !cid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

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

    let orderData = await orderRef.get()
    if (!orderData.exists) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    let order = orderData.data().order
    let order_no = getOrderNo(order, order_id)
    if (order_no == -1) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST })
    }
    if (order.length <= Number(order_no)) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST })
    }

    order[order_no] = req.body

    orderRef.set({ order: order }, { merge: true }).then((e) => {
      return res
        .status(200)
        .json({ success: true, message: 'Successfully updated' })
    })
  } catch (err) {
    let e = extractErrorMessage(err)
    logger.error({
      label: `admin order setOrderById ${req.user.rest_id}`,
      message: e,
    })
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR })
  }
}

function getOrderNo(order, order_id) {
  let order_no = order
    .map((e) => {
      return e.id
    })
    .indexOf(order_id)
  return order_no
}
