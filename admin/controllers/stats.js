const admin = require("firebase-admin");
const firestore = admin.firestore();

var html_to_pdf = require("html-pdf-node");
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
let moment = require("moment");
const path = require("path");
const fs = require("fs");
let ejs = require("ejs");
let pdf = require("html-pdf");
const sizeof = require("firestore-size");
var bson = require("bson");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
const { InvoiceModel } = require("../../models/invoice");
const mongoose = require("mongoose");
const { default: BSON } = require("bson");

exports.getInvoices = (req, res) => {
  firestore
    .collection("orders")
    .doc(req.user.rest_id)
    .collection("invoices")
    .get()
    .then((resp) => {
      let data = [];

      for (let ele of resp.docs) {
        let temp = ele.data();
        temp.id = ele.id;
        data.push(temp);
      }
      res.status(200).json({ data: data, success: true });
    })
    .catch((err) => {
      res.status(500).json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.getHomeForOwner = async (req, res) => {
  try {
    let rest_details_ref = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .get();

    let seatOrderRef = await firestore
      .collection(`restaurants/${req.user.rest_id}/order`)
      .get();

    let takeawayOrderRef = await firestore
      .collection(`restaurants/${req.user.rest_id}/torder`)
      .get();

    let customersRef = await firestore
      .collection(`restaurants/${req.user.rest_id}/customers`)
      .doc("users")
      .get();

    let seatCust = customersRef.data().seat || [];

    let obj = {
      total_occupied: 0,
      total_checkout: 0,
      total_vaccant: 0,
      seat_order: 0,
      takeaway_order: 0,
      total_table: 0,
    };

    let rest_details = rest_details_ref.data();
    if (rest_details.type) {
      for (let t of rest_details.type) {
        obj.total_table += Number(t.tables);
      }
    } else {
      obj.total_table = Number(rest_details.tables);
    }

    for (let data of seatCust) {
      if (data.restore) {
        continue;
      }
      if (data.checkout) {
        obj.total_checkout++;
      } else {
        obj.total_occupied++;
      }
    }

    obj.total_vaccant =
      obj.total_table - obj.total_occupied - obj.total_checkout;

    if (!seatOrderRef.empty) {
      for (let doc of seatOrderRef.docs) {
        let data = doc.data();
        if (data.restore || data.cancel) {
          continue;
        }
        for (let order of data.order) {
          if (order.restore || order.cancel) {
            continue;
          }
          obj.seat_order++;
        }
      }
    }

    if (!takeawayOrderRef.empty) {
      for (let doc of takeawayOrderRef.docs) {
        let data = doc.data();
        if (data.restore || data.cancel) {
          continue;
        }
        for (let order of data.order) {
          if (order.restore || order.cancel) {
            continue;
          }
          obj.takeaway_order++;
        }
      }
    }

    res.status(200).json({ success: true, data: obj });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin state getHomeForOwner ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.downloadInvoicePdf = async (req, res) => {
  try {
    let inv_id = req.params.inv_id;

    if (!inv_id) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }
    let rest_details = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .get();

    let data = rest_details.data();

    let invoice = await InvoiceModel.findById(inv_id);

    let userRef = await firestore.collection("users").doc(invoice.cid).get();
    let user;
    if (!userRef.exists) {
      user = { name: invoice.canme, mobile_no: "", email: "" };
    } else {
      user = userRef.data();
    }

    var fileName = `invoice-${invoice.cid}.pdf`;

    var output_path = process.env.INVOICE_PATH + fileName;
    await ejs.renderFile(
      path.join(__dirname + "/../../utils/templates/invoice.ejs"),
      {
        invoice: invoice,
        user: user,
        rest: data,
        inv_date: moment(invoice.inv_date).format("DD/MM/YYYY"),
      },
      (err, data) => {
        if (err) {
          console.log(err);
          throw err;
        } else {
          let options = {
            format: "A4", // allowed units: A3, A4, A5, Legal, Letter, Tabloid
            orientation: "portrait", // portrait or landscape
            border: "0",
            type: "pdf",
          };

          pdf.create(data, options).toFile(output_path, function (err, data) {
            if (err) {
              console.log(err);
              throw err;
            } else {
              fs.readFile(output_path, function (err, data) {
                fs.unlinkSync(output_path);
                res.contentType("application/pdf");
                res.status(200).send(data);
              });
            }
          });
        }
      }
    );
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin state downloadInvoicePdf ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

function IsIn2D(str, array) {
  for (var i = 0; i < array.length; i++) {
    if (array[i].name == str) {
      return i;
    }
  }
  return -1;
}
exports.downloadEodPdf = async (req, res) => {
  try {
    let rest_details = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .get();

    let interval = req.params.interval;

    if (!interval) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    interval = interval.split("_");

    if (interval.length != 2) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let start_date = interval[0];
    let end_date = interval[1];

    let invoices = await InvoiceModel.find({
      rest_id: req.user.rest_id,
      inv_date: { $gte: start_date },
      inv_date: { $lte: end_date },
    });

    let data = rest_details.data();

    let total = {
      total_gross: 0,
      total_net: 0,
      total_discount: 0,
      total_cash: 0,
      total_card: 0,
      total_credit: 0,
      total_online: 0,
      total_tax: 0,
      total_cust: 0,
    };
    let invoice_array = [];
    let topPerformer = [];

    for (let tempInvoice of invoices) {
      if (!tempInvoice.settle) {
        continue;
      }
      for (let itemFromInvoice of tempInvoice.data) {
        var ind = IsIn2D(itemFromInvoice.name, [...topPerformer]);

        if (ind > -1) {
          topPerformer[ind].qty += itemFromInvoice.qty;
        } else {
          topPerformer.push({
            name: itemFromInvoice.name,
            qty: itemFromInvoice.qty,
            category: itemFromInvoice.category,
          });
        }
      }
      topPerformer.sort((a, b) => (b.qty > a.qty ? 1 : a.qty > b.qty ? -1 : 0));

      tempInvoice.gross = tempInvoice.taxable;
      total.total_gross += tempInvoice.gross;
      if (tempInvoice.discount) {
        tempInvoice.dis = tempInvoice.discount.includes("%")
          ? Number(
              (tempInvoice.taxable *
                Number(tempInvoice.discount.split("%")[0])) /
                100
            )
          : Number(tempInvoice.discount);
      } else {
        tempInvoice.dis = 0;
      }
      total.total_discount += Number(tempInvoice.dis) || 0;

      tempInvoice.tax =
        Number(tempInvoice.taxable - tempInvoice.discount) *
        (Number(tempInvoice.tax) / 100);
      total.total_tax += tempInvoice.tax;

      total.total_net += tempInvoice.total_amt;
      total.total_credit += tempInvoice.settle.credit;
      total.total_cust++;

      switch (tempInvoice.settle.method) {
        case "cash":
          total.total_cash += tempInvoice.total_amt - tempInvoice.settle.credit;
          tempInvoice.cash = tempInvoice.total_amt - tempInvoice.settle.credit;
          break;
        case "card":
          total.total_card += tempInvoice.total_amt - tempInvoice.settle.credit;
          tempInvoice.card = tempInvoice.total_amt - tempInvoice.settle.credit;
          break;
        case "online":
          tempInvoice.online =
            tempInvoice.total_amt - tempInvoice.settle.credit;
          total.total_online += tempInvoice.online;
          break;
      }
      if (!tempInvoice.type) {
        if (tempInvoice.table == "takeaway") {
          tempInvoice.type = "Takeaway";
        } else {
          tempInvoice.type = "Seat";
        }
      } else {
        let index = data?.type
          ?.map((e) => {
            return e.value;
          })
          .indexOf(tempInvoice.type);
        if (index != -1) {
          tempInvoice.type = data.type[index].name;
        }
      }
      invoice_array.push(tempInvoice);
    }

    invoice_array.sort((a, b) =>
      a.invoice_no > b.invoice_no ? 1 : b.invoice_no > a.invoice_no ? -1 : 0
    );

    var fileName = `eod-${start_date}-${rest_details.id}.pdf`;

    var output_path = process.env.EOD_PATH + fileName;
    await ejs.renderFile(
      path.join(__dirname + "/../../utils/templates/eod.ejs"),
      {
        invoice_array: invoice_array,
        rest: data,
        date: start_date,
        total: total,
        topPerformer: topPerformer,
      },
      (err, data) => {
        if (err) {
          throw err;
        } else {
          let options = {
            format: "A4", // allowed units: A3, A4, A5, Legal, Letter, Tabloid
            orientation: "portrait", // portrait or landscape
            border: "0",
            type: "pdf",
          };

          pdf.create(data, options).toFile(output_path, function (err, data) {
            if (err) {
              throw err;
            } else {
              fs.readFile(output_path, function (err, data) {
                fs.unlinkSync(output_path);
                res.contentType("application/pdf");
                res.status(200).send(data);
              });
            }
          });
        }
      }
    );
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin state downloadEodPdf ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.downloadSalesReportPdf = async (req, res) => {
  try {
    let rest_details = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .get();

    let interval = req.params.interval;

    if (!interval) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    interval = interval.split("_");

    if (interval.length != 2) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let start_date = interval[0];
    let end_date = interval[1];

    let invoices = await InvoiceModel.find({
      rest_id: req.user.rest_id,
      inv_date: { $gte: start_date },
      inv_date: { $lte: end_date },
    });

    let data = rest_details.data();

    let total = {
      total_gross: 0,
      total_net: 0,
      total_discount: 0,
      total_cash: 0,
      total_card: 0,
      total_credit: 0,
      total_online: 0,
      total_tax: 0,
      total_cust: 0,
    };

    let totalType = [];
    let typeIndex = {};

    let i = 0;

    for (let type of data.type) {
      typeIndex[`${type.value}`] = { name: type.name, index: i };
      totalType.push({ type: type.name, value: type.value, ...total });
      i++;
    }
    typeIndex[`takeaway`] = { name: "Takeaway", index: i };
    totalType.push({ type: "Takeaway", value: "takeaway", ...total });

    let invoice_array = [];

    for (let tempInvoice of invoices) {
      if (!tempInvoice.settle) {
        continue;
      }

      if (tempInvoice.table == "takeaway") {
        tempInvoice.type = "takeaway";
      }

      let index = typeIndex[`${tempInvoice.type}`].index;

      tempInvoice.type = typeIndex[`${tempInvoice.type}`].name;

      let tempTotal = { ...totalType[index] };

      tempInvoice.gross = tempInvoice.taxable;
      total.total_gross += tempInvoice.gross;
      tempTotal.total_gross += tempInvoice.gross;

      if (tempInvoice.discount) {
        tempInvoice.dis = tempInvoice.discount.includes("%")
          ? Number(
              (tempInvoice.taxable *
                Number(tempInvoice.discount.split("%")[0])) /
                100
            )
          : Number(tempInvoice.discount);
      } else {
        tempInvoice.dis = 0;
      }
      total.total_discount += Number(tempInvoice.dis) || 0;
      tempTotal.total_discount += Number(tempInvoice.dis) || 0;

      tempInvoice.tax =
        Number(tempInvoice.taxable - tempInvoice.discount) *
        (Number(tempInvoice.tax) / 100);
      total.total_tax += tempInvoice.tax;
      tempTotal.total_tax += tempInvoice.tax;

      total.total_net += tempInvoice.total_amt;
      tempTotal.total_net += tempInvoice.total_amt;
      total.total_credit += tempInvoice.settle.credit;
      tempTotal.total_credit += tempInvoice.settle.credit;
      total.total_cust++;
      tempTotal.total_cust++;

      switch (tempInvoice.settle.method) {
        case "cash":
          total.total_cash += tempInvoice.total_amt - tempInvoice.settle.credit;
          tempInvoice.cash = tempInvoice.total_amt - tempInvoice.settle.credit;
          tempTotal.total_cash += tempInvoice.cash;
          break;
        case "card":
          total.total_card += tempInvoice.total_amt - tempInvoice.settle.credit;
          tempInvoice.card = tempInvoice.total_amt - tempInvoice.settle.credit;
          tempTotal.total_card += tempInvoice.card;
          break;
        case "online":
          tempInvoice.online =
            tempInvoice.total_amt - tempInvoice.settle.credit;
          total.total_online += tempInvoice.online;
          tempTotal.total_online += tempInvoice.online;
          break;
      }
      invoice_array.push(tempInvoice);
      totalType[index] = tempTotal;
    }

    invoice_array.sort((a, b) =>
      a.invoice_no > b.invoice_no ? 1 : b.invoice_no > a.invoice_no ? -1 : 0
    );

    var fileName = `sales-${start_date}-${rest_details.id}.pdf`;

    var output_path = process.env.EOD_PATH + fileName;
    await ejs.renderFile(
      path.join(__dirname + "/../../utils/templates/sales.ejs"),
      {
        invoice_array: invoice_array,
        rest: data,
        start_date: moment(start_date, "YYYY-MM-DD").format("DD-MM-YYYY"),
        end_date: moment(end_date, "YYYY-MM-DD").format("DD-MM-YYYY"),
        total: total,
        totalType: totalType,
      },
      async (err, data) => {
        if (err) {
          throw err;
        } else {
          /*   let options = {
            format: "A4", // allowed units: A3, A4, A5, Legal, Letter, Tabloid
            orientation: "portrait", // portrait or landscape
            border: "0",
            type: "pdf",
          }; */

          let options = { format: "A4" };
          // Example of options with args //
          // let options = { format: 'A4', args: ['--no-sandbox', '--disable-setuid-sandbox'] };

          let file = { content: data, name: output_path };

          html_to_pdf.generatePdf(file, options).then((pdfBuffer) => {
            console.log("PDF Buffer:-", pdfBuffer);
            /*      fs.readFile(output_path, function (err, data) {
              fs.unlinkSync(output_path);
              res.contentType("application/pdf");
              res.status(200).send(data);
            }); */
            res.contentType("application/pdf");
            res.status(200).send(pdfBuffer);
          });

          /*  pdf.create(data, options).toFile(output_path, function (err, data) {
            if (err) {
              throw err;
            } else {
              fs.readFile(output_path, function (err, data) {
                fs.unlinkSync(output_path);
                res.contentType("application/pdf");
                res.status(200).send(data);
              });
            }
          }); */
        }
      }
    );
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin state downloadEodPdf ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getBasicsByInterval = async (req, res, next) => {
  try {
    let interval = req.params.interval;

    if (!interval) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    interval = interval.split("_");

    if (interval.length != 2) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let start_date = interval[0];
    let end_date = interval[1];
    InvoiceModel.find({
      $and: [
        { rest_id: req.user.rest_id },
        { inv_date: { $gte: start_date } },
        { inv_date: { $lte: end_date } },
      ],
    }).then((invoiceRef) => {
      console.log(invoiceRef);
      let itemsArray = [];
      let total_taxable = 0;
      let total = {
        total_orders: 0,
        // total_gross: 0,
        total_sales: 0,
        total_discount: 0,
        total_cash: 0,
        total_card: 0,
        total_credit: 0,
        total_online: 0,
        total_tax: 0,
        total_cust: 0,
        total_U_customers: 0,
        total_item: 0,
      };
      for (let tempInvoice of invoiceRef) {
        if (!tempInvoice.settle) {
          continue;
        }
        total.total_orders++;

        if (tempInvoice.unique) {
          total.total_U_customers++;
        }

        for (let items of tempInvoice.data) {
          if (!itemsArray.includes(items.name)) {
            // console.log(items.name)
            itemsArray.push(items.name);
          }
        }
        total.total_item = itemsArray.length;

        total_taxable += tempInvoice.taxable;

        if (tempInvoice.discount) {
          tempInvoice.discount = tempInvoice.discount.includes("%")
            ? Number(
                (tempInvoice.taxable *
                  Number(tempInvoice.discount.split("%")[0])) /
                  100
              )
            : tempInvoice.discount;
        } else {
          tempInvoice.discount = 0;
        }
        total.total_discount += Number(tempInvoice.discount) || 0;

        tempInvoice.tax =
          Number(tempInvoice.taxable - tempInvoice.discount) *
          (tempInvoice.tax / 100);
        total.total_tax += tempInvoice.tax;

        total.total_credit += tempInvoice.settle.credit;
        total.total_cust++;
        total.total_sales += tempInvoice.total_amt - tempInvoice.settle.credit;

        switch (tempInvoice.settle.method) {
          case "cash":
            total.total_cash +=
              tempInvoice.total_amt - tempInvoice.settle.credit;
            tempInvoice.cash =
              tempInvoice.total_amt - tempInvoice.settle.credit;
            break;
          case "card":
            total.total_card +=
              tempInvoice.total_amt - tempInvoice.settle.credit;
            tempInvoice.card =
              tempInvoice.total_amt - tempInvoice.settle.credit;
            break;
          case "online":
            tempInvoice.online =
              tempInvoice.total_amt - tempInvoice.settle.credit;
            total.total_online += tempInvoice.online;
            break;
        }
      }
      res.status(200).json({ success: true, data: total });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin state getBasicByInterval ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getInvoicesByInterval = async (req, res, next) => {
  try {
    let interval = req.params.interval;

    if (!interval) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    interval = interval.split("_");

    if (interval.length != 2) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let start_date = interval[0];
    let end_date = interval[1];

    InvoiceModel.find({
      $and: [
        { rest_id: req.user.rest_id },
        { inv_date: { $gte: start_date } },
        { inv_date: { $lte: end_date } },
      ],
    }).then((data) => {
      let invoices = [];
      for (let i of data) {
        if (!i.settle) {
          continue;
        }

        invoices.push(i);
      }
      res.status(200).json({ success: true, data: invoices });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin state getInvoicesByInterval ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getCategoriesStats = async (req, res, next) => {
  try {
    let interval = req.params.interval;

    if (!interval) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    interval = interval.split("_");

    if (interval.length != 2) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let cat = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("categories")
      .get();

    let menuRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("menu")
      .doc("menu")
      .get();

    let categories = {};
    let items = {};
    if (!cat.empty) {
      cat.docs.map((e) => {
        let data = e.data().cat;
        for (let e of data) {
          categories[`${e.name}`] = 0;
          items[`${e.name}`] = {};
        }
      });
    }

    for (let menu of menuRef.data().menu) {
      items[menu.category][menu.name] = { qty: 0, price: 0 };
    }

    let start_date = interval[0];
    let end_date = interval[1];

    let data = await InvoiceModel.find({
      $and: [
        { rest_id: req.user.rest_id },
        { inv_date: { $gte: start_date } },
        { inv_date: { $lte: end_date } },
      ],
    });

    let invoices = [];

    for (let i of data) {
      i.id = i._id;
      invoices.push(i);
      for (let ele of i.data) {
        if (categories[`${ele.category}`] == undefined) {
          continue;
        }
        categories[`${ele.category}`] += ele.qty;
        if (items[`${ele.category}`][`${ele.name}`]) {
          let q = items[`${ele.category}`][`${ele.name}`].qty;
          let p = items[`${ele.category}`][`${ele.name}`].price;
          items[`${ele.category}`][`${ele.name}`] = {
            qty: q + ele.qty,
            price: p + ele.price,
          };
        }
      }
    }
    res
      .status(200)
      .json({ success: true, data: { categories: categories, items: items } });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin state getCategoriesStats ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.getAdvanceStats = async (req, res, next) => {
  try {
    let interval = req.params.interval;
    let slot = req.params.slot;

    if (!interval || !slot) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    interval = interval.split("_");

    if (interval.length != 2) {
      return res
        .status(400)
        .json({ status: false, message: status.BAD_REQUEST });
    }

    let start_date = interval[0];
    let end_date = interval[1];

    let intervalData;
    if (slot == "this-week") {
      intervalData = await getSlotBetweenInterval(slot, "", "");
      let data = await InvoiceModel.find({
        $and: [
          { rest_id: req.user.rest_id },
          { inv_date: { $gte: start_date } },
          { inv_date: { $lte: end_date } },
        ],
      });

      for (let i of data) {
        index = moment(i.inv_date).weekday();
        intervalData[index].value += i.total_amt;
      }
    } else if (slot.includes("month")) {
      intervalData = await getSlotBetweenInterval(slot, "", "");
      let data = await InvoiceModel.find({
        $and: [
          { rest_id: req.user.rest_id },
          { inv_date: { $gte: start_date } },
          { inv_date: { $lte: end_date } },
        ],
      });

      for (let i of data) {
        index = moment(i.inv_date).format("D");
        intervalData[index - 1].value += i.total_amt;
      }
    } else if (slot == "today") {
      let rest_ref = await firestore
        .collection("restaurants")
        .doc(req.user.rest_id)
        .get();
      let rest_details = rest_ref.data();
      intervalData = await getSlotBetweenInterval(
        slot,
        rest_details.open_time,
        rest_details.close_time
      );
      console.log(intervalData);
      let data = await InvoiceModel.find({
        $and: [
          { rest_id: req.user.rest_id },
          { inv_date: { $gte: start_date } },
          { inv_date: { $lte: end_date } },
        ],
      });
      for (let i of data) {
        let time = Number(i.time.split(":")[0]);
        if (i.time) {
          index = intervalData.findIndex(
            (e) => time >= e.open_t && time < e.close_t
          );

          console.log(index, i.time);

          if (index == -1) {
            if (i.time > rest_details.close_time)
              index = intervalData.length - 1;
            else if (i.time < rest_details.open_time) index = 0;
          }
          intervalData[index].value += i.total_amt;
        }
      }
    } else if (slot.includes("quarter")) {
      let slotData = await getMonthsOfQuarter(slot);
      intervalData = slotData[0];
      let starting_month = slotData[1];
      let data = await InvoiceModel.find({
        $and: [
          { rest_id: req.user.rest_id },
          { inv_date: { $gte: start_date } },
          { inv_date: { $lte: end_date } },
        ],
      });
      for (let i of data) {
        index = moment(i.inv_date).month();
        intervalData[index - starting_month].value += i.total_amt;
      }
    } else if (slot == "last-year" || slot == "this-year") {
      intervalData = await getMonthsOfYear(slot);
      let data = await InvoiceModel.find({
        $and: [
          { rest_id: req.user.rest_id },
          { inv_date: { $gte: start_date } },
          { inv_date: { $lte: end_date } },
        ],
      });

      for (let i of data) {
        index = moment(i.inv_date).month();
        index = index < 3 ? index + 9 : index - 3;
        intervalData[index].value += i.total_amt;
      }
    }

    res.status(200).json({ success: true, data: intervalData });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin state getAdvanceStats ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

function getSlotBetweenInterval(interval, start, end) {
  try {
    let data = [];
    switch (interval) {
      case "today":
        let o = start.split(":");
        let c = end.split(":");
        if (c[0] == "00") {
          c[0] = "24";
        }
        if (o[1] != "00") {
          if (Number(o[0]) + 2 <= Number(c[0])) {
            let name = `${moment(start, "HH:mm").format("h:mm A")}-${moment(
              `${Number(o[0]) + 2}:00`,
              "HH:mm"
            ).format("h A")}`;
            o[1] = ":00";
            let temp = {
              name: name,
              open_t: Number(o[0]),
              close_t: Number(o[0]) + 2,
              value: 0,
            };
            o[0] = Number(o[0]) + 2;
            data.push(temp);
          }
        }

        while (Number(o[0]) + 2 < Number(c[0])) {
          let name = `${moment(`${o[0]}:00`, "HH:mm").format("h A")}-${moment(
            `${Number(o[0]) + 2}:00`,
            "HH:mm"
          ).format("h A")}`;
          let temp = {
            name: name,
            open_t: Number(o[0]),
            close_t: Number(o[0]) + 2,
            value: 0,
          };
          o[0] = Number(o[0]) + 2;
          data.push(temp);
        }

        if (Number(o[0]) != Number(c[0])) {
          let name;
          if (c[1] != "00") {
            name = `${moment(`${o[0]}:00`, "HH:mm").format("h A")}-${moment(
              `${c[0]}:${c[1]}`,
              "HH:mm"
            ).format("hh:mm A")}`;
          } else {
            name = `${moment(`${o[0]}:00`, "HH:mm").format("h A")}-${moment(
              `${c[0]}:${c[1]}`,
              "HH:mm"
            ).format("h A")}`;
          }

          let temp = {
            name: name,
            open_t: Number(o[0]),
            close_t: Number(c[0]),
            value: 0,
          };
          data.push(temp);
        }

        break;

      case "this-week":
        for (let i = 0; i < 7; i++) {
          let day = moment().weekday(i).format("dddd");
          data.push({ name: day, value: 0 });
        }
        break;

      case "this-month":
        days = moment().utcOffset(process.env.UTC_OFFSET).daysInMonth();
        month = moment(
          moment().utcOffset(process.env.UTC_OFFSET).month() + 1,
          "MM"
        )
          .utcOffset(process.env.UTC_OFFSET)
          .format("MMM");
        for (let i = 1; i <= days; i++) {
          data.push({ name: i + " " + month, value: 0 });
        }
        break;

      case "last-month":
        days = moment()
          .utcOffset(process.env.UTC_OFFSET)
          .subtract(1, "months")
          .daysInMonth();
        month = moment(
          moment()
            .utcOffset(process.env.UTC_OFFSET)
            .subtract(1, "months")
            .month() + 1,
          "MM"
        )
          .utcOffset(process.env.UTC_OFFSET)
          .format("MMM");
        for (let i = 1; i <= days; i++) {
          data.push({ name: i + " " + month, value: 0 });
        }
    }
    return data;
  } catch (err) {
    throw err;
  }
}

function getMonthsOfQuarter(quarter) {
  try {
    let months = [];
    let starting_month;
    switch (quarter) {
      case "quarter-1":
        current_month = moment().month();
        starting_month = 3;
        if (current_month < 3) {
          for (let i = 3; i <= 5; i++) {
            month = moment(i + 1, "MM").format("MMM");
            months.push({
              name: month,
              value: 0,
            });
          }
        } else {
          for (let i = 3; i <= 5; i++) {
            month = moment(i + 1, "MM").format("MMM");
            months.push({
              name: month,
              value: 0,
            });
          }
        }
        break;
      case "quarter-2":
        starting_month = 6;
        current_month = moment().month();
        if (current_month < 3) {
          for (let i = 6; i <= 8; i++) {
            month = moment(i + 1, "MM").format("MMM");
            months.push({
              name: month,
              value: 0,
            });
          }
        } else {
          for (let i = 6; i <= 8; i++) {
            month = moment(i + 1, "MM").format("MMM");
            months.push({
              name: month,
              value: 0,
            });
          }
        }
        break;
      case "quarter-3":
        starting_month = 9;
        current_month = moment().month();
        if (current_month < 3) {
          for (let i = 9; i <= 11; i++) {
            month = moment(i + 1, "MM").format("MMM");
            months.push({
              name: month,
              value: 0,
            });
          }
        } else {
          for (let i = 9; i <= 11; i++) {
            month = moment(i + 1, "MM").format("MMM");
            months.push({
              name: month,
              value: 0,
            });
          }
        }
        break;
      case "quarter-4":
        starting_month = 0;
        current_month = moment().month();
        if (current_month >= 3) {
          for (let i = 0; i <= 2; i++) {
            month = moment(i + 1, "MM").format("MMM");
            months.push({
              name: month,
              value: 0,
            });
          }
        } else {
          for (let i = 0; i <= 2; i++) {
            month = moment(i + 1, "MM").format("MMM");
            months.push({
              name: month,
              value: 0,
            });
          }
        }
        break;
    }
    return [months, starting_month];
  } catch (err) {
    throw err;
  }
}

function getMonthsOfYear(slot) {
  try {
    let data = [];
    switch (slot) {
      case "this-year":
        current_month = moment().utcOffset(process.env.UTC_OFFSET).month();
        if (current_month >= 3) {
          for (let i = 3; i <= 11; i++) {
            month = moment(i + 1, "MM").format("MMM");
            year = moment().year();
            data.push({
              name: month,
              year: year,
              value: 0,
            });
          }
          for (let i = 0; i <= 2; i++) {
            month = moment(i + 1, "MM").format("MMM");
            year = moment().add(1, "year").year();
            data.push({
              name: month,
              year: year,
              value: 0,
            });
          }
        } else {
          for (let i = 3; i <= 11; i++) {
            month = moment(i + 1, "MM").format("MMM");
            year = moment().subtract(1, "year").year();
            data.push({
              name: month,
              year: year,
              value: 0,
            });
          }
          for (let i = 0; i <= 2; i++) {
            month = moment(i + 1, "MM").format("MMM");
            year = moment().year();
            data.push({
              name: month,
              year: year,
              value: 0,
            });
          }
        }
        break;
      case "last-year":
        current_month = moment().utcOffset(process.env.UTC_OFFSET).month();
        if (current_month >= 3) {
          for (let i = 3; i <= 11; i++) {
            month = moment(i + 1, "MM").format("MMM");
            year = moment().subtract(1, "year").year();
            data.push({
              name: month,
              year: year,
              value: 0,
            });
          }
          for (let i = 0; i <= 2; i++) {
            month = moment(i + 1, "MM").format("MMM");
            year = moment().year();
            data.push({
              name: month,
              year: year,
              value: 0,
            });
          }
        } else {
          for (let i = 3; i <= 11; i++) {
            month = moment(i + 1, "MM").format("MMM");
            year = moment().subtract(2, "year").year();
            data.push({
              name: month,
              year: year,
              value: 0,
            });
          }
          for (let i = 0; i <= 2; i++) {
            month = moment(i + 1, "MM").format("MMM");
            year = moment().subtract(1, "year").year();
            dataa.push({
              name: month,
              year: year,
              value: 0,
            });
          }
        }
    }
    return data;
  } catch (err) {
    throw err;
  }
}
