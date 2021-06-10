const admin = require("firebase-admin");
const firestore = admin.firestore();

const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
let moment = require("moment");
const path = require("path");
const fs = require("fs");
let ejs = require("ejs");
let pdf = require("html-pdf");

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

exports.downloadInvoicePdf = async (req, res) => {
  let rest_details = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .get();

  let invoiceRef = await firestore
    .collection("orders")
    .doc(req.user.rest_id)
    .collection("invoices")
    .doc(req.params.id)
    .get();

  let invoice = invoiceRef.data();
  let data = rest_details.data();

  let userRef = await firestore.collection("users").doc(invoice.cid).get();
  let user = userRef.data();

  var fileName = `invoice-${invoice.cid}.pdf`;

  var output_path = process.env.INVOICE_PATH + fileName;
  await ejs.renderFile(
    path.join(__dirname + "/../../utils/templates/invoice.ejs"),
    {
      invoice: invoice,
      user: user,
      rest: data,
      invoice_date: moment(invoice.invoice_date).format("DD/MM/YYYY"),
    },
    (err, data) => {
      if (err) {
        console.log(err);
      } else {
        let options = {
          format: "A4", // allowed units: A3, A4, A5, Legal, Letter, Tabloid
          orientation: "portrait", // portrait or landscape
          border: "0",
          type: "pdf",
          /* header: {
          height: "1400px",
          width: "100px",
          contents: `<div style="position: absolute;top: 0;left: 0; bottom: 0; height: 1400px;width: 100px;background: url("https://drive.google.com/thumbnail?id=1hgGQNIMxQIgEA72UlUU8eF0crWFnsKVL") center bottom no-repeat, url("https://drive.google.com/thumbnail?id=1RnQX_4yl-cSc9rhXtC3BC_AoJnL4d0IE") repeat">
          <div style=" -moz-border-radius: 50%;
          -webkit-border-radius: 50%;
          border-radius: 50%;
          background: #415472;
          width: 30px;
          height: 30px;
          position: absolute;
          left: 33%; top: 440px;"></div>
          <div style=" -moz-border-radius: 50%;
          -webkit-border-radius: 50%;
          border-radius: 50%;
          background: #415472;
          width: 30px;
          height: 30px;
          position: absolute;
          left: 33%;top: 690px;></div>
          </div>`,
          }, */
        };

        pdf.create(data, options).toFile(output_path, function (err, data) {
          if (err) {
            console.log(err);
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
};

exports.getInvoicesByInterval = async (req, res, next) => {
  let interval = req.params.interval;

  if (!interval) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  interval = interval.split("_");

  if (interval.length != 2) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let start_date = interval[0];
  let end_date = interval[1];

  await firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .where("invoice_date", ">=", start_date)
    .where("invoice_date", "<=", end_date)
    .get()
    .then((data) => {
      let invoices = [];
      for (let invoice of data.docs) {
        let i = invoice.data();
        i.id = invoice.id;
        invoices.push(i);
      }
      res.status(200).json({ success: true, data: invoices });
    })
    .catch((err) => {
      res.status(500).json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.getCategoriesStats = async (req, res, next) => {
  let interval = req.params.interval;

  if (!interval) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  interval = interval.split("_");

  if (interval.length != 2) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let cat = await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("categories")
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

  let start_date = interval[0];
  let end_date = interval[1];

  let data = await firestore
    .collection(`orders/${req.user.rest_id}/invoices`)
    .where("invoice_date", ">=", start_date)
    .where("invoice_date", "<=", end_date)
    .get();

  let invoices = [];
  for (let invoice of data.docs) {
    let i = invoice.data();
    i.id = invoice.id;
    invoices.push(i);
    for (let ele of i.data) {
      if (categories[`${ele.category}`] == "undefined") {
        categories[`${ele.category}`] = 0;
        items[`${ele.category}`] = {};
      }
      if (!items[`${ele.category}`][`${ele.name}`]) {
        items[`${ele.category}`][`${ele.name}`] = { qty: 0, price: 0 };
      }
      categories[`${ele.category}`] += ele.qty;
      let q = items[`${ele.category}`][`${ele.name}`].qty;
      let p = items[`${ele.category}`][`${ele.name}`].price;
      items[`${ele.category}`][`${ele.name}`] = {
        qty: q + ele.qty,
        price: p + ele.price,
      };
    }
  }
  res
    .status(200)
    .json({ success: true, data: { categories: categories, items: items } });
};

exports.getAdvanceStats = async (req, res, next) => {
  let interval = req.params.interval;
  let slot = req.params.slot;

  if (!interval || !slot) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  interval = interval.split("_");

  if (interval.length != 2) {
    return res.status(400).json({ status: false, message: status.BAD_REQUEST });
  }

  let start_date = interval[0];
  let end_date = interval[1];

  let intervalData;
  if (slot == "this-week") {
    intervalData = await getSlotBetweenInterval(slot, "", "");
    let data = await firestore
      .collection(`orders/${req.user.rest_id}/invoices`)
      .where("invoice_date", ">=", start_date)
      .where("invoice_date", "<=", end_date)
      .get();

    for (let invoice of data.docs) {
      let i = invoice.data();
      index = moment(i.invoice_date).weekday();
      intervalData[index].value += i.total_amt;
    }
  } else if (slot.includes("month")) {
    intervalData = await getSlotBetweenInterval(slot, "", "");
    let data = await firestore
      .collection(`orders/${req.user.rest_id}/invoices`)
      .where("invoice_date", ">=", start_date)
      .where("invoice_date", "<=", end_date)
      .get();

    for (let invoice of data.docs) {
      let i = invoice.data();
      index = moment(i.invoice_date).format("D");
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

    let data = await firestore
      .collection(`orders/${req.user.rest_id}/invoices`)
      .where("invoice_date", ">=", start_date)
      .where("invoice_date", "<=", end_date)
      .get();

    for (let invoice of data.docs) {
      let i = invoice.data();
      if (i.time) {
        index = intervalData.findIndex(
          (e) => i.time >= e.open_t && i.time < e.close_t
        );
        console.log(index);
        if (index == -1) {
          if (i.time > rest_details.close_time) index = intervalData.length - 1;
          else if (i.time < rest_details.open_time) index = 0;
        }
        intervalData[index].value += i.total_amt;
      }
    }
  } else if (slot.includes("quarter")) {
    let slotData = await getMonthsOfQuarter(slot);
    intervalData = slotData[0];
    let starting_month = slotData[1];
    let data = await firestore
      .collection(`orders/${req.user.rest_id}/invoices`)
      .where("invoice_date", ">=", start_date)
      .where("invoice_date", "<=", end_date)
      .get();

    for (let invoice of data.docs) {
      let i = invoice.data();
      index = moment(i.invoice_date).month();
      intervalData[index - starting_month].value += i.total_amt;
    }
    
  } else if (slot == "last-year" || slot == "this-year") {
    intervalData = await getMonthsOfYear(slot);
    let data = await firestore
      .collection(`orders/${req.user.rest_id}/invoices`)
      .where("invoice_date", ">=", start_date)
      .where("invoice_date", "<=", end_date)
      .get();
console.log(intervalData)
    for (let invoice of data.docs) {
      let i = invoice.data();
      index = moment(i.invoice_date).month();
      index = index < 3 ? index + 9 : index - 3;
      intervalData[index].value += i.total_amt;
    }
  }

  res.status(200).json({ success: true, data: intervalData });
};

function getSlotBetweenInterval(interval, start, end) {
  let data = [];
  switch (interval) {
    case "today":
      let o = start.split(":");
      let c = end.split(":");
      if(c[0] == '00'){
        c[0] = '24'
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
            open_t: start,
            close_t: Number(o[0]) + 2 + ":00",
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
          open_t: `${o[0]}:00`,
          close_t: `${Number(o[0]) + 2}:00`,
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
          open_t: `${o[0]}:00`,
          close_t: `${end}`,
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
        days = moment().utcOffset(process.env.UTC_OFFSET).subtract(1, 'months').daysInMonth();
        month = moment(
          moment().utcOffset(process.env.UTC_OFFSET).subtract(1, 'months').month() + 1,
          "MM"
        )
          .utcOffset(process.env.UTC_OFFSET)
          .format("MMM");
        for (let i = 1; i <= days; i++) {
          data.push({ name: i + " " + month, value: 0 });
        }
  }
  return data;
}

function getMonthsOfQuarter(quarter) {
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
}

function getMonthsOfYear(slot) {
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
  return data
}
