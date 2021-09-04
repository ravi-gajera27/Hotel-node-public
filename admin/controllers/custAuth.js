const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");
const moment = require("moment");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
const { InvoiceModel } = require("../../models/invoice");
const mongoose = require("mongoose");

exports.acceptRequest = async (req, res, next) => {
  if (!req.params.cid) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }
  try {
    let custoemrsRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");

    let userRef = await firestore.collection("users").doc(req.params.cid);

    await firestore
      .runTransaction(async (t) => {
        let takeawayCust = (await t.get(custoemrsRef)).data().takeaway || [];
        let index;
        let flag = false;
        takeawayCust.map((cust, i) => {
          if (cust.cid == req.params.cid) {
            cust.req = true;
            index = i;
            flag = true;
          }
        });

        if (!flag) {
          return Promise.resolve({
            success: false,
            status: 400,
            message: status.BAD_REQUEST,
          });
        }

        let userData = (await t.get(userRef)).data();

        let join = false;

        if (userData.join && userData.join != req.user.rest_id) {
          join = true;
          takeawayCust.splice(index, 1);
        }

        await t.set(custoemrsRef, { takeaway: takeawayCust }, { merge: true });
        return Promise.resolve({ success: true, join: join });
      })
      .then(async (promise) => {
        if (promise.success) {
          if (promise.join) {
            return res
              .status(403)
              .json({ success: false, message: status.SESSION_EXIST_REST });
          } else {
            await userRef.set({ join: req.user.rest_id }, { merge: true });
            return res
              .status(200)
              .json({ success: true, message: status.ACCEPT_REQUEST_ADMIN });
          }
        } else {
          return res
            .status(promise.status)
            .json({ success: false, message: promise.message });
        }
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth acceptRequest ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.rejectRequest = async (req, res, next) => {
  if (!req.params.cid) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }
  try {
    let customersRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");

    firestore
      .runTransaction(async (t) => {
        let takeawayCust = (await t.get(customersRef)).data().takeaway || [];

        let tempTakeawayCust = takeawayCust.filter(
          (cust) => cust.cid != req.params.cid
        );

        if (tempTakeawayCust.length == takeawayCust.length) {
          return Promise.resolve({
            success: false,
            status: 400,
            message: status.BAD_REQUEST,
          });
        }

        await t.set(
          customersRef,
          { takeaway: [...tempTakeawayCust] },
          { merge: true }
        );
        return Promise.resolve({ success: true });
      })
      .then((promise) => {
        if (promise.success) {
          return res
            .status(200)
            .json({ success: true, message: status.REJECT_REQUEST_ADMIN });
        } else {
          return res
            .status(promise.status)
            .json({ success: false, message: promise.message });
        }
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth rejectRequest ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.blockCustomer = async (req, res, next) => {
  if (!req.params.cid) {
    return res
      .status(400)
      .json({ success: false, message: status.BAD_REQUEST });
  }
  try {
    let customersRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");

    let userRef = await firestore.collection("users").doc(req.params.cid);

    firestore
      .runTransaction(async (t) => {
        let takeawayCust = (await t.get(customersRef)).data().takeaway || [];

        let tempTakeawayCust = takeawayCust.filter(
          (cust) => cust.cid != req.params.cid
        );

        if (tempTakeawayCust.length == takeawayCust.length) {
          return Promise.resolve({
            success: false,
            status: 400,
            message: status.BAD_REQUEST,
          });
        }

        let blocked = moment()
          .utcOffset(process.env.UTC_OFFSET)
          .format("YYYY-MM-DD");

        await t.set(
          customersRef,
          { takeaway: [...tempTakeawayCust] },
          { merge: true }
        );

        await t.set(userRef, { blocked: blocked, join: "" }, { merge: true });

        return Promise.resolve({ success: true });
      })
      .then((promise) => {
        if (promise.success) {
          return res
            .status(200)
            .json({ success: true, message: status.BLOCK_REQUEST_ADMIN });
        } else {
          return res
            .status(promise.status)
            .json({ success: false, message: promise.message });
        }
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth blockCustomer ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.removeCustomer = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let cid = req.params.cid;
    let type = req.params.type;

    if (!table_no || !cid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let orderRef;

    let customersRef = await firestore
      .collection(`restaurants`)
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users");

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

    await firestore.runTransaction(async (t) => {
      let customers = (await t.get(customersRef)).data();
      let takeawayCust = customers.takeaway || [];
      let seatCust = customers.seat || [];
      if (table_no == "takeaway") {
        let newCustomers = [];

        for (let cust of takeawayCust) {
          if (cust.restore) {
            continue;
          }
          if (cust.table == table_no && cust.cid == cid) {
            cust.restore = true;
          }
          newCustomers.push(cust);
        }

        seatCust = seatCust.filter((e) => !e.restore);

        await t.set(
          customersRef,
          {
            takeaway: [...newCustomers],
            seat: [...seatCust],
          },
          { merge: true }
        );
      } else {
        let newCustomers = [];

        for (let cust of seatCust) {
          if (cust.restore) {
            continue;
          }
          if (cust.table == table_no && cust.cid == cid) {
            cust.restore = true;
          }
          newCustomers.push(cust);
        }
        takeawayCust = takeawayCust.filter((e) => !e.restore);

        await t.set(
          customersRef,
          {
            seat: [...newCustomers],
            takeaway: [...takeawayCust],
          },
          { merge: true }
        );
      }
    });

    let order = await orderRef.get();

    if (order.exists) {
      await orderRef.set({ restore: true }, { merge: true }).then(async (e) => {
        if (cid.length != 12) {
          await firestore
            .collection("users")
            .doc(cid)
            .set({ join: "" }, { merge: true });
        }

        return res.status(200).json({
          success: true,
          message: `Sessoin from table-${table_no} is successfully terminated`,
        });
      });
    } else {
      if (cid.length != 12) {
        await firestore
          .collection("users")
          .doc(`${cid}`)
          .set({ join: "" }, { merge: true });
      }
      return res.status(200).json({
        success: true,
        message: `Sessoin from table-${table_no} is successfully terminated`,
      });
    }
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth removeCustomer ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.restoreCustomer = async (req, res, next) => {
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

    let customers;
    let orderRef;

    if (table_no == "takeaway") {
      orderRef = firestore
        .collection(`restaurants/${req.user.rest_id}/torder`)
        .doc(`${cid}`);

      customers = (await customersRef.get()).data().takeaway || [];
    } else {
      customers = (await customersRef.get()).data().seat || [];
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

    firestore
      .runTransaction(async (t) => {
        if (table_no == "takeaway") {
          customers = (await customersRef.get()).data().takeaway || [];
        } else {
          customers = (await customersRef.get()).data().seat || [];
        }
        let index = customers.findIndex((ele) => {
          return cid == ele.cid && ele.table == table_no;
        });

        if (index == -1) {
          return Promise.resolve({ success: false });
        }
        delete customers[index].restore;

        if (table_no == "takeaway") {
          customers = await t.set(
            customersRef,
            { takeaway: [...customers] },
            { merge: true }
          );
        } else {
          customers = await t.set(
            customersRef,
            { seat: [...customers] },
            { merge: true }
          );
        }
        return Promise.resolve({ success: true });
      })
      .then(async (promise) => {
        if (!promise.success) {
          return res
            .status(400)
            .json({ success: false, message: status.BAD_REQUEST });
        } else {
          let order = await orderRef.get();
          console.log(order.exists, order.data(), cid);
          if (order.exists && order.data().cid == cid) {
            await orderRef.set({ restore: false }, { merge: true });
          }

          if (cid.length != 12) {
            await firestore
              .collection("users")
              .doc(cid)
              .set({ join: req.user.rest_id }, { merge: true });
          }

          return res
            .status(200)
            .json({ success: true, message: status.RESTORED });
        }
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth restoreCustomer ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.checkoutCustomer = async (req, res, next) => {
  try {
    let table_no = req.params.table_no;
    let cid = req.params.cid;
    let type = req.params.type || "";

    if (!table_no || !cid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let customerRef = firestore
      .collection(`restaurants/${req.user.rest_id}/customers`)
      .doc("users");

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

    let orderDoc = await orderRef.get();
    let orderData = orderDoc.data();

    if (!orderDoc.exists || !orderData.cid || orderData.order.length == 0) {
      return res
        .status(403)
        .json({ success: false, message: "Customer is not ordered yet" });
    }

    if (orderData.cid != cid) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let finalInvoice = { data: [] };

    if (orderData.restore || orderData.cancel) {
      return res.status(403).json({
        success: false,
        message: "Order of this customer is already canceled",
      });
    }

    let restore = 0;

    for (let order of orderData.order) {
      if (order.restore || order.cancel) {
        restore++;
      }
    }

    if (restore == orderData.order.length) {
      return res.status(403).json({
        success: false,
        message: "All orders of customer is already canceled",
      });
    }

    for (let ele of orderData.order) {
      if (ele.restore || ele.cancel) {
        continue;
      }
      let order = { ...ele };

      if (finalInvoice.data.length != 0) {
        finalInvoice.taxable += order.taxable;
        finalInvoice.qty += order.qty;
        let index = finalInvoice.data.length;
        for (let i = 0; i < order.data.length; i++) {
          let flag = true;
          for (let j = 0; j < index; j++) {
            if (
              order.data[i].name == finalInvoice.data[j].name &&
              order.data[i].type == finalInvoice.data[j].type &&
              order.data[i].addon.length == finalInvoice.data[j].addon.length
            ) {
              let check = order.data[i].addon.every(
                (el) => finalInvoice.data[j].addon.indexOf(el) >= 0
              );
              if (check == true) {
                finalInvoice.data[j].qty += order.data[i].qty;
                finalInvoice.data[j].price += order.data[i].price;
                flag = false;
                break;
              }
            }
          }
          if (flag) {
            finalInvoice.data.push(order.data[i]);
          }
        }
      } else {
        delete order.id;
        delete order.inst;
        finalInvoice = JSON.parse(JSON.stringify(order));
      }

      if (res.unique) {
        finalInvoice.unique = true;
      }
    }

    let restRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id);

    let rest_details = await restRef.get();

    let restData = rest_details.data();
    restData = await setInvoiceNumber(restData);
    if (!restData) {
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    }

    finalInvoice.cid = cid;
    finalInvoice.cname = orderData.cname;
    finalInvoice.table = table_no;
    if (type) {
      finalInvoice.type = type;
    }
    finalInvoice.inv_no = restData.inv_no;
    finalInvoice.clean = false;
    delete finalInvoice.date;
    delete finalInvoice.qty;
    finalInvoice.inv_date = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .format("YYYY-MM-DD");
    finalInvoice.time = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .format("HH:mm");
    finalInvoice.tax = Number(restData.tax);

    if (restData.taxInc) {
      finalInvoice.total_amt = finalInvoice.taxable;
      finalInvoice.taxable =
        (finalInvoice.taxable * 100) / (100 + restData.tax);
      finalInvoice.taxInc = true;
    } else {
      finalInvoice.total_amt =
        finalInvoice.taxable + (finalInvoice.taxable * restData.tax) / 100;
    }

    InvoiceModel.create(finalInvoice).then(async (e) => {
      await firestore.runTransaction(async (t) => {
        let customers = await t.get(customerRef);
        let seatCust = customers.data()?.seat || [];
        let takeawayCust = customers.data()?.takeaway || [];

        let index;
        if (table_no == "takeaway") {
          index = takeawayCust.findIndex(
            (ele) =>
              ele.cid == cid &&
              ele.table == table_no &&
              ele.cname == orderData.cname
          );
          let obj = { ...takeawayCust[index] };

          obj.checkout = true;
          obj.inv_id = e.id;
          delete obj.req;
          takeawayCust[index] = obj;
        } else {
          if (type) {
            index = seatCust.findIndex(
              (ele) =>
                ele.cid == cid &&
                ele.table == table_no &&
                ele.type == type &&
                ele.cname == orderData.cname
            );
          } else {
            index = seatCust.findIndex(
              (ele) =>
                ele.cid == cid &&
                ele.table == table_no &&
                ele.cname == orderData.cname
            );
          }
          seatCust[index].checkout = true;
          seatCust[index].inv_id = e.id;
        }
        await t.set(
          customerRef,
          { seat: [...seatCust], takeaway: [...takeawayCust] },
          { merge: true }
        );
      });

      await orderRef.delete();
      await restRef.set(restData, { merge: true });
      return res
        .status(200)
        .json({ success: true, message: "Successfully checkout" });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth checkoutCustomer ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.updateInvoice = async (req, res) => {
  try {
    let invoice = req.body;
    let inv_id = req.params.inv_id;

    if (!inv_id) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    delete invoice.order_no;

    InvoiceModel.findByIdAndUpdate(
      mongoose.Types.ObjectId(inv_id),
      invoice
    ).then((e) => {
      return res
        .status(200)
        .json({ success: true, message: "Successfully Changed" });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth updateInvoice ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.cleanUpCustomers = async (req, res) => {
  try {
    let invoice = req.body;
    let inv_id = req.params.inv_id;
    let type = req.body.type;
    invoice.rest_id = req.user.rest_id;

    if (!invoice.cid || !invoice.table || !inv_id) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    let customerRef = firestore
      .collection(`restaurants/${req.user.rest_id}/customers`)
      .doc("users");

    delete invoice.order_no;
    delete invoice.clean;

    InvoiceModel.findByIdAndUpdate(inv_id, invoice).then(async (e) => {
      await firestore.runTransaction(async (t) => {
        let customers = await t.get(customerRef);

        let seatCust = customers.data()?.seat || [];
        let takeawayCust = customers.data()?.takeaway || [];

        if (invoice.table == "takeaway") {
          takeawayCust = takeawayCust.filter(
            (ele) => ele.cid != invoice.cid && ele.table != invoice.table
          );
        } else {
          if (type) {
            let index = seatCust.findIndex(
              (ele) =>
                ele.cid == invoice.cid &&
                ele.table == invoice.table &&
                ele.type == type
            );
            if (index != -1) {
              seatCust.splice(index, 1);
            }
          } else {
            seatCust = seatCust.filter(
              (ele) => ele.cid != invoice.cid && ele.table != invoice.table
            );
          }
        }

        await t.set(
          customerRef,
          { seat: [...seatCust], takeaway: [...takeawayCust] },
          { merge: true }
        );
      });
      if (invoice.cid.length != 12) {
        console.log("cid:", invoice.cid);
        await firestore
          .collection("users")
          .doc(invoice.cid)
          .set({ join: "" }, { merge: true });
      }
      return res
        .status(200)
        .json({ success: true, message: "Successfully Cleaned up" });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth cleanUpCustomer ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

function generateSingleOrder(orderData) {
  let finalInvoice = { data: [] };

  for (let ele of orderData.order) {
    if (ele.restore || ele.cancel) {
      continue;
    }
    let order = { ...ele };

    if (finalInvoice.data.length != 0) {
      finalInvoice.taxable += order.taxable;
      finalInvoice.qty += order.qty;
      let index = finalInvoice.data.length;
      for (let i = 0; i < order.data.length; i++) {
        let flag = true;
        for (let j = 0; j < index; j++) {
          if (
            order.data[i].name == finalInvoice.data[j].name &&
            order.data[i].type == finalInvoice.data[j].type &&
            order.data[i].addon.length == finalInvoice.data[j].addon.length
          ) {
            let check = order.data[i].addon.every(
              (el) => finalInvoice.data[j].addon.indexOf(el) >= 0
            );
            if (check == true) {
              finalInvoice.data[j].qty += order.data[i].qty;
              finalInvoice.data[j].price += order.data[i].price;
              flag = false;
              break;
            }
          }
        }
        if (flag) {
          finalInvoice.data.push(order.data[i]);
        }
      }
    } else {
      finalInvoice = JSON.parse(JSON.stringify(order));
    }

    if (orderData.unique) {
      finalInvoice.unique = true;
    }
  }
  return finalInvoice;
}

function setInvoiceNumber(data) {
  try {
    let invoice_format = data.invoice_format;
    let set_invoice_no = "";

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
          : "") +
        invoice_format.start_num;
      data.invoice_format.curr_num = invoice_format.start_num;
    } else {
      let current_month = moment().utcOffset(process.env.UTC_OFFSET).month();
      let fan_year;
      if (current_month < 3) {
        fan_year =
          moment()
            .utcOffset(process.env.UTC_OFFSET)
            .subtract(1, "year")
            .format("YYYY")
            .substr(-2) +
          "-" +
          moment().utcOffset(process.env.UTC_OFFSET).format("YYYY").substr(-2);
      } else {
        fan_year =
          moment().utcOffset(process.env.UTC_OFFSET).format("YYYY").substr(-2) +
          "-" +
          moment()
            .utcOffset(process.env.UTC_OFFSET)
            .add(1, "year")
            .format("YYYY")
            .substr(-2);
      }
      if (fan_year != invoice_format.fan_year) {
        invoice_format.fan_year =
          moment().utcOffset(process.env.UTC_OFFSET).format("YYYY").substr(-2) +
          "-" +
          moment()
            .utcOffset(process.env.UTC_OFFSET)
            .add(1, "year")
            .format("YYYY")
            .substr(-2);
        data.invoice_format.curr_num = invoice_format.start_num;
        set_invoice_no =
          invoice_format.start_text +
          invoice_format.middle_symbol +
          (invoice_format.year
            ? moment()
                .utcOffset(process.env.UTC_OFFSET)
                .year()
                .toString()
                .substr(-2) + invoice_format.middle_symbol
            : "") +
          invoice_format.start_num;
      }
    }

    let curr_num = invoice_format.curr_num;
    if (!set_invoice_no) {
      let n1 = curr_num.toString();
      let n2 = (parseInt(curr_num) + 1).toString();
      let l1 = n1.length;
      let l2 = n2.length;
      if (l1 > l2) {
        n2 = n1.substr(0, l1 - l2) + n2;
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
          : "") +
        n2;

      data.invoice_format.curr_num = n2;
    }

    data.inv_no = set_invoice_no;

    return data;
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin custAuth setInvoiceNumber ${req.user.rest_id}`,
      message: e,
    });
    return null;
  }
}
