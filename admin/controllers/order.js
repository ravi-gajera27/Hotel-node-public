const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
const randomstring = require("randomstring");
const moment = require("moment");
const { InvoiceModel } = require("../../models/invoice");

exports.cancelOrder = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let order_id = req.params.order_id;
    let cid = req.params.cid;
    let type = req.params.type;
    let restoreOrder = req.body?.restoreOrder;
    console.log(table_no, order_id, cid);

    if (!table_no || !order_id || !cid) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let orderRef;
    let restoreOrderRef;
    if (table_no == "takeaway") {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/torder`)
        .doc(`${cid}`);

      if (
        restoreOrder.table_no &&
        restoreOrder.order_id &&
        restoreOrder.table_no != cid
      ) {
        restoreOrderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(
            `${
              restoreOrder.type
                ? restoreOrder.type + "-table-" + restoreOrder.table_no
                : "table-" + restoreOrder.table_no
            }`
          );
      }
    } else {
      if (type) {
        orderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`${type}-table-${table_no}`);
      } else {
        orderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`table-${table_no}`);
      }

      if (
        restoreOrder.table_no &&
        restoreOrder.order_id &&
        restoreOrder.table_no != table_no
      ) {
        restoreOrderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(
            `${
              restoreOrder.type
                ? restoreOrder.type + "-table-" + restoreOrder.table_no
                : "table-" + restoreOrder.table_no
            }`
          );
      }
    }

    let orderData = await orderRef.get();
    let order_no;

    if (orderData.exists) {
      let order = JSON.parse(JSON.stringify(orderData.data().order));
      order_no = getOrderNo(order, order_id);
      if (order_no == -1) {
        return res
          .status(400)
          .json({ status: false, message: status.BAD_REQUEST });
      }
      if (Number(order_no) <= order.length) {
        order.map((e) => {
          if (e.restore) {
            delete e.restore;
            e.cancel = true;
          }
        });
        order[Number(order_no)].restore = true;

        let previousOrder;
        if (restoreOrderRef) {
          console.log(restoreOrder);
          let restoreOrderDoc = await restoreOrderRef.get();
          if (!restoreOrderDoc.exists) {
            return res
              .status(400)
              .json({ status: false, message: status.BAD_REQUEST });
          }

          let order = restoreOrderDoc.data().order;

          let index = order
            .map((e) => {
              return e.id;
            })
            .indexOf(restoreOrder.order_id);
          if (index != -1) {
            delete order[index].restore;
            order[index].cancel = true;
            previousOrder = order;
          }
        }
        orderRef.set({ order: order }, { merge: true }).then(async (order) => {
          if (previousOrder) {
            await restoreOrderRef.set(
              { order: previousOrder },
              { merge: true }
            );
          }
          return res.status(200).json({
            success: true,
            message: `Order-${Number(order_no + 1)} from ${
              table_no == "takeaway" ? "Takeaway" : "Table-" + table_no
            } is successfully cancelled`,
          });
        });
      } else {
        return res
          .status(400)
          .json({ status: false, message: status.BAD_REQUEST });
      }
    } else {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order cancelOrder ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.restoreOrder = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let order_id = req.params.order_id;
    let type = req.params.type;
    let cid = req.params.cid;

    if (!table_no || !order_id || !cid) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let orderRef;
    let order_no;
    if (table_no == "takeaway") {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/torder`)
        .doc(`${cid}`);
    } else {
      if (type) {
        orderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`${type}-table-${table_no}`);
      } else {
        orderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`table-${table_no}`);
      }
    }

    let orderData = await orderRef.get();
    if (orderData.exists) {
      let order = JSON.parse(JSON.stringify(orderData.data().order));
      order_no = getOrderNo(order, order_id);
      if (order_no == -1) {
        return res
          .status(400)
          .json({ status: false, message: status.BAD_REQUEST });
      }
      if (Number(order_no) <= order.length) {
        delete order[Number(order_no)].restore;

        orderRef.set({ order: order }, { merge: true }).then((order) => {
          return res.status(200).json({
            success: true,
            message: `Order-${Number(order_no + 1)} from ${
              table_no == "takeaway" ? "Takeaway" : "Table-" + table_no
            } is successfully restored`,
          });
        });
      } else {
        return res
          .status(400)
          .json({ status: false, message: status.BAD_REQUEST });
      }
    } else {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order restoreOrder ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

/* exports.generateInvoice = async (req, res, next) => {
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
} */

exports.generateInvoice = async (req, res, next) => {
  try {
    let inv_id = req.params.inv_id;

    if (!inv_id) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let invoice = await InvoiceModel.findById(inv_id);

    let rest_ref = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .get();

    rest_ref = rest_ref.data();

    let rest_details = {
      rest_name: rest_ref.rest_name,
      rest_address: rest_ref.address,
      gst_in: rest_ref.gst_in || "",
    };

    res.status(200).json({
      success: true,
      data: { invoice: invoice, rest_details: rest_details },
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order generateInvoice ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getOrderByOrderId = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let order_id = req.params.order_id;
    let type = req.params.type;
    let cid = req.params.cid;

    if (!table_no || !order_id || !cid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let orderRef;

    if (table_no == "takeaway") {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/torder`)
        .doc(`${cid}`);
    } else {
      if (type) {
        orderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`${type}-table-${table_no}`);
      } else {
        orderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`table-${table_no}`);
      }
    }

    let orderData = await orderRef.get();
    if (!orderData.exists) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let order = orderData.data().order;

    let order_no = getOrderNo(order, order_id);

    if (order_no == -1) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    if (order.length <= Number(order_no)) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    return res.status(200).json({ success: true, data: order[order_no] });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order getOrderById ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.setOrderByOrderId = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let order_id = req.params.order_id;
    let type = req.params.type;
    let cid = req.params.cid;

    if (!table_no || !order_id || !cid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let orderRef;
    if (table_no == "takeaway") {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/torder`)
        .doc(`${cid}`);
    } else {
      if (type) {
        orderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`${type}-table-${table_no}`);
      } else {
        orderRef = firestore
          .collection(`restaurants/${req.user.rest_id}/order`)
          .doc(`table-${table_no}`);
      }
    }

    let orderData = await orderRef.get();
    if (!orderData.exists) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let order = orderData.data().order;
    let order_no = getOrderNo(order, order_id);
    if (order_no == -1) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }
    if (order.length <= Number(order_no)) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    order[order_no] = req.body;

    orderRef.set({ order: order }, { merge: true }).then((e) => {
      return res
        .status(200)
        .json({ success: true, message: "Successfully updated" });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order setOrderById ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getOrderByTableNo = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let type = req.params.type;

    let orderRef;
    if (type) {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`${type}-table-${table_no}`);
    } else {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`table-${table_no}`);
    }

    orderRef = await orderRef.get();

    if (!orderRef.exists) {
      return res.status(200).json({ success: true, data: { order: [] } });
    }

    let orderData = orderRef.data();

    let order = [];
    if (!orderData.restore) {
      order = [...orderData.order];
    }

    return res.status(200).json({
      success: true,
      data: { order: order },
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order getOrderByTableNo rest: ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.addOrderByTableNo = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let cid = req.params.cid;
    let type = req.params.type;

    if (!table_no) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }
    let orderRef;
    if (type) {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`${type}-table-${table_no}`);
    } else {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`table-${table_no}`);
    }

    let customersRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");

    let id = await generateRandomString();
    let order_id = await generateRandomStringForOrder();

    let data = {
      data: [...req.body],
      table: table_no,
      date: moment().utcOffset(process.env.UTC_OFFSET).unix(),
      qty: 0,
      taxable: 0,
      id: order_id,
    };

    for (let item of req.body) {
      data.qty += item.qty;
      data.taxable += item.price;
    }

    let body = {};
    if (cid) {
      body = {
        cid: cid,
        order: [{ ...data }],
        type: type || "",
      };
    } else {
      body = {
        cname: req.user.role,
        cid: id,
        order: [{ ...data }],
        type: type || "",
      };
    }

    await firestore
      .runTransaction(async (t) => {
        let data = (await t.get(customersRef)).data();
        let customers = data.seat || [];
        let customer;
        let tables = 0;
        if (type) {
          let index = data.type
            .map((e) => {
              return e.value;
            })
            .indexOf(type);

          tables = data.type[index].tables;
        } else {
          tables = data.type[0].tables;
        }
        if (Number(tables) < Number(table_no)) {
          return Promise.resolve({
            success: false,
            statu: 400,
            message: status.BAD_REQUEST,
          });
        }

        console.log("1");
        for (let cust of customers) {
          if (type) {
            if (Number(cust.table) == Number(table_no) && cust.type == type) {
              customer = cust;
            }
            if (
              cust.table == table_no &&
              cust.type == type &&
              cust.cname != req.user.role &&
              cust.cid != cid
            ) {
              console.log("2", cust);
              return Promise.resolve({
                success: false,
                status: 403,
                message: status.SESSION_EXIST,
              });
            }
          } else {
            if (cust.table == table_no) {
              customer = cust;
            }
            if (
              cust.table == table_no &&
              (cust.cname != req.user.role || cust.cid != cid)
            ) {
              return Promise.resolve({
                success: false,
                statu: 403,
                message: status.SESSION_EXIST,
              });
            }
          }
        }

        if (customer) {
          body.cname = customer.cname;
        }

        if (!cid) {
          if (type) {
            customers.push({
              cname: req.user.role,
              checkout: false,
              cid: id,
              table: table_no,
              type: type,
            });
          } else {
            customers.push({
              cname: req.user.role,
              checkout: false,
              cid: id,
              table: table_no,
            });
          }
          await t.set(customersRef, { seat: [...customers] }, { merge: true });
        }

        return Promise.resolve({ success: true });
      })
      .then(async (promise) => {
        if (promise.success) {
          await orderRef.set(body);
          return res
            .status(200)
            .json({ success: true, message: "Order Place Successfully" });
        } else {
          return res
            .status(promise.status)
            .json({ success: false, message: promise.message });
        }
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order addOrderByTableNo admin: ${req.user.id} rest: ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.setOrderByTableNo = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let type = req.params.type;

    let orderRef;
    if (type) {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`${type}-table-${table_no}`);
    } else {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`table-${table_no}`);
    }

    let customersRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");

    let data = (await customersRef.get()).data();

    let customers = data.seat || [];
    let tables = 0;
    if (type) {
      let index = data.type
        .map((e) => {
          return e.value;
        })
        .indexOf(type);
      tables = data.type[index].tables;
    } else {
      tables = data.type[0].tables;
    }
    if (Number(tables) < Number(table_no)) {
      return res
        .status(400)
        .json({ success: false, message: status.INVALID_TABLE });
    }

    let flag = false;

    for (let cust of customers) {
      if (type) {
        if (cust.table == table_no && cust.type == type) {
          flag = true;
          break;
        }
      } else {
        if (cust.table == table_no) {
          flag = true;
          break;
        }
      }
    }

    if (!flag) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let finalOrder = req.body;

    let tempOrder = [];

    for (let order of req.body.order) {
      qty = 0;
      taxable = 0;
      for (let item of order.data) {
        qty += item.qty;
        taxable += item.price;
      }
      order.qty = qty;
      order.taxable = taxable;
      order.table = table_no;
      if (!order.date) {
        order.date = moment().utcOffset(process.env.UTC_OFFSET).unix();
      }
      if (!order.id) {
        let validId = false;
        let id;
        do {
          id = await generateRandomStringForOrder();
          let filter = tempOrder.filter((e) => e.id == id);
          if (filter.length == 0) {
            validId = true;
          }
        } while (!validId);
        order.id = id;
      }
      tempOrder.push({ ...order });
    }

    finalOrder.order = [...tempOrder];
    orderRef.set(finalOrder, { merge: true }).then(async (e) => {
      return res
        .status(200)
        .json({ success: true, message: "Order Successfully set" });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order setOrderByTableNo captain: ${req.user.id} rest: ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.cancelAllOrderByTableNo = async (req, res) => {
  try {
    let table_no = req.params.table_no;
    let cid = req.params.cid;
    let type = req.params.type;

    if (!table_no || !cid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let customersRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");

    let orderRef;
    if (type) {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`${type}-table-${table_no}`);
    } else {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/order`)
        .doc(`table-${table_no}`);
    }

    if (cid.length != 12) {
      return res
        .status(200)
        .json({ success: true, message: "Successfully canceled" });
    }

    orderRef.delete().then(async (e) => {
      await firestore.runTransaction(async (t) => {
        let customers = (await t.get(customersRef)).data().seat || [];
        if (type) {
          customers = customers.filter(
            (e) => e.table != table_no && e.type == type
          );
        } else {
          customers = customers.filter((e) => e.table != table_no);
        }
        await t.set(customersRef, { seat: [...customers] }, { merge: true });
      });
      return res
        .status(200)
        .json({ success: true, message: "Successfully canceled" });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin order cancelAllOrderByTableNo captain: ${req.user.id} rest: ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

async function generateRandomString() {
  return await randomstring.generate({
    length: 12,
    charset: "alphabetic",
  });
}

async function generateRandomStringForOrder() {
  return await randomstring.generate({
    length: 8,
    charset: "alphanumeric",
  });
}

function getOrderNo(order, order_id) {
  let order_no = order
    .map((e) => {
      return e.id;
    })
    .indexOf(order_id);
  return order_no;
}
