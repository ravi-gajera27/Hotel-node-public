const firestore = require("../../config/db").firestore();
const admin = require("firebase-admin");
const { extractCookie } = require("../../utils/cookie-parser");
const status = require("../../utils/status");
let moment = require("moment");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
const randomstring = require("randomstring");
const { InvoiceModel } = require("../../models/invoice");

exports.addOrder = async (req, res, next) => {
  let cookie = await extractCookie(req, res);
  try {
    if (!cookie) {
      res.status(403).json({ success: false, message: status.SCAN_QR });
    }

    let orderRef;
    let customerRef = await firestore
      .collection("restaurants")
      .doc(cookie.rest_id)
      .collection("customers")
      .doc("users")
      .get();

    let customers;

    if (cookie.table == "takeaway") {
      orderRef = await firestore
        .collection(`restaurants/${cookie.rest_id}/torder/`)
        .doc(`${req.user.id}`);

      customers = customerRef.data().takeaway;
    } else {
      if (cookie.type) {
        orderRef = await firestore
          .collection(`restaurants/${cookie.rest_id}/order/`)
          .doc(`${cookie.type}-table-${cookie.table}`);
      } else {
        orderRef = await firestore
          .collection(`restaurants/${cookie.rest_id}/order/`)
          .doc(`table-${cookie.table}`);
      }
      customers = customerRef.data().seat;
    }

    let valid = false;
    for (let cust of customers) {
      if (
        cust.table == cookie.table && cust.cid == req.user.id && cookie.type
          ? cookie.type == cust.type
          : true
      ) {
        if (cust.restore) {
          break;
        }
        valid = true;
        if (cookie.table == "takeaway") {
          if (cust.req == undefined) {
            return res
              .status(403)
              .json({ success: true, message: status.REQUEST_NOT_ACCEPT });
          }
        }
      }
    }

    if (!valid) {
      return res.status(403).json({ success: false, message: status.SCAN_QR });
    }

    let order = await orderRef.get();

    let orderData = [];
    restorAble = false;
    if (order.exists) {
      let data = order.data();
      orderData = data.order;
      if (data.restore) {
        restorAble = true;
        orderData = [];
      } else if (data.cid && data.cid != req.user.id) {
        return res
          .status(403)
          .json({ success: false, message: status.SESSION_EXIST });
      }
    }

    let send_data;
    req.body.date = moment().utcOffset(process.env.UTC_OFFSET).unix();
    req.body.table = cookie.table;

    if (orderData.length == 0) {
      req.body.id = await generateRandomString();
      if (restorAble) {
        send_data = {
          cid: req.user.id,
          cname: req.user.name,
          order: [{ ...req.body }],
          type: cookie.type || "",
          restore: false,
        };
      } else {
        send_data = {
          cid: req.user.id,
          cname: req.user.name,
          type: cookie.type || "",
          order: [{ ...req.body }],
        };
      }

      let userRef = await firestore
        .collection(`restaurants/${cookie.rest_id}/users/`)
        .doc(req.user.id);
      let user = await userRef.get();
      if (user.exists) {
        user = user.data();
        await userRef.set({
          cname: req.user.name,
          mobile_no: req.user.mobile_no || "",
          email: req.user.email,
          last_visit: moment()
            .utcOffset(process.env.UTC_OFFSET)
            .format("YYYY-MM-DD"),
          count: (Number(user.count) + 1).toString(),
        });
      } else {
        await userRef.set({
          cname: req.user.name,
          mobile_no: req.user.mobile_no || "",
          email: req.user.email,
          last_visit: moment()
            .utcOffset(process.env.UTC_OFFSET)
            .format("YYYY-MM-DD"),
          count: "1",
        });
        send_data.unique = true;
      }
    } else {
      let validId = false;
      let id;
      do {
        id = await generateRandomString();
        let filter = orderData.filter((e) => e.id == id);
        if (filter.length == 0) {
          validId = true;
        }
      } while (!validId);
      req.body.id = id;
      orderData.push(req.body);
      send_data = orderData;
      send_data = { order: [...send_data] };
    }
    orderRef.set(send_data, { merge: true }).then(async (order) => {
      return res
        .status(200)
        .json({ success: true, message: "Your order is successfully placed" });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `customer order addOrder cust: ${req.user.id} rest: ${cookie.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getOrder = async (req, res, next) => {
  console.log(req.body);
  let cookie = await extractCookie(req, res);

  if (!cookie) {
    res.status(401).json({ success: false, message: status.SCAN_QR });
  }

  let orderRef;

  if (cookie.table == "takeaway") {
    orderRef = await firestore
      .collection(`restaurants/${cookie.rest_id}/torder/`)
      .doc(`${req.user.id}`);
  } else {
    if (cookie.type) {
      orderRef = await firestore
        .collection(`restaurants/${cookie.rest_id}/order/`)
        .doc(`${cookie.type}-table-${cookie.table}`);
    } else {
      orderRef = await firestore
        .collection(`restaurants/${cookie.rest_id}/order/`)
        .doc(`table-${cookie.table}`);
    }
  }

  let order = await orderRef.get();

  let orderData = [];
  if (order.exists) {
    let data = order.data();
    orderData = data.order;
    if (data.cid && data.cid != req.user.id) {
      res.status(403).json({ success: false, message: status.SESSION_EXIST });
    } else {
      return res.status(200).json({ success: true, data: orderData });
    }
  }
};

exports.checkout = async (req, res, next) => {
  let cookie = await extractCookie(req, res);
  try {
    if (!cookie) {
      res.status(401).json({ success: false, message: status.UNAUTHORIZED });
    }

    let orderRef;

    if (cookie.table == "takeaway") {
      orderRef = await firestore
        .collection(`restaurants/${cookie.rest_id}/torder/`)
        .doc(`${req.user.id}`);
    } else {
      if (cookie.type) {
        orderRef = await firestore
          .collection(`restaurants/${cookie.rest_id}/order/`)
          .doc(`${cookie.type}-table-${cookie.table}`);
      } else {
        orderRef = await firestore
          .collection(`restaurants/${cookie.rest_id}/order/`)
          .doc(`table-${cookie.table}`);
      }
    }

    let orderExist = await orderRef.get();

    if (!orderExist.exists) {
      res.status(400).json({ success: false, message: status.BAD_REQUEST });
    } else if (orderExist.data().cid != req.user.id) {
      res.status(400).json({ success: false, message: status.BAD_REQUEST });
    }

    let restRef = await firestore.collection("restaurants").doc(cookie.rest_id);

    let rest_details = await restRef.get();

    let data = rest_details.data();

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

    req.body.cid = req.user.id;
    req.body.cname = req.user.name;
    req.body.table = cookie.table;
    req.body.inv_no = set_invoice_no;
    if (cookie.type) {
      req.body.type = cookie.type;
    }
    req.body.clean = false;
    delete req.body.date;
    delete req.body.qty;
    req.body.inv_date = moment()
      .utcOffset(process.env.UTC_OFFSET)
      .format("YYYY-MM-DD");
    req.body.time = moment().utcOffset(process.env.UTC_OFFSET).format("HH:mm");
    req.body.tax = Number(data.tax);
    if (data.taxInc) {
      req.body.total_amt = req.body.taxable;
      req.body.taxable = (req.body.taxable * 100) / (100 + data.tax);
      req.body.taxInc = true;
    } else {
      req.body.total_amt =
        req.body.taxable + (req.body.taxable * data.tax) / 100;
    }

    let customersRef = await firestore
      .collection("restaurants")
      .doc(cookie.rest_id)
      .collection("customers")
      .doc("users");

    InvoiceModel.create(req.body)
      .then(async (e) => {
        await firestore.runTransaction(async (t) => {
          let customers = (await t.get(customersRef)).data();
          let seatCust = customers?.seat || [];
          let takeawayCust = customers?.takeaway || [];

          let index;
          if (cookie.table == "takeaway") {
            index = takeawayCust.findIndex(
              (ele) => ele.cid == req.user.id && ele.table == cookie.table
            );
            let obj = { ...takeawayCust[index] };
            obj.checkout = true;
            obj.inv_id = e.id;
            delete obj.req;
            takeawayCust[index] = obj;
          } else {
            index = seatCust.findIndex(
              (ele) =>
                ele.cid == req.user.id &&
                ele.table == cookie.table &&
                (cookie.type ? cookie.type == ele.type : true)
            );

            seatCust[index].checkout = true;
            seatCust[index].inv_id = e.id;
          }

          await t.set(
            customersRef,
            { seat: [...seatCust], takeaway: [...takeawayCust] },
            { merge: true }
          );
        });

        await orderRef.delete();
        await restRef.set(data, { merge: true });
        return res
          .status(200)
          .json({ success: true, message: "Successfully checkout" });
      })
      .catch((err) => {
        console.log(err);
        return res
          .status(500)
          .json({ success: false, message: status.SERVER_ERROR });
      });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `customer order checkout cust: ${req.user.id} rest: ${cookie.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

async function generateRandomString() {
  return await randomstring.generate({
    length: 8,
    charset: "alphanumeric",
  });
}
