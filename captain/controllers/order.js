const firestore = require("../../config/db").firestore();

const status = require("../../utils/status");
let moment = require("moment");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");
const randomstring = require("randomstring");
const { CustomerModel } = require("../../models/customer");

exports.addOrder = async (req, res, next) => {
  let table = req.params.table_no;
  let type = req.params.type;
  try {
    if (!table) {
      res.status(403).json({ success: false, message: status.BAD_REQUEST });
    }

    let customerRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("customers")
      .doc("users")
      .get();

    let orderRef;
    if (type) {
      orderRef = await firestore
        .collection(`restaurants/${req.user.rest_id}/order/`)
        .doc(`${type}-table-${table}`);
    } else {
      orderRef = await firestore
        .collection(`restaurants/${req.user.rest_id}/order/`)
        .doc(`table-${table}`);
    }

    let customers = customerRef.data().seat || [];

    let valid = false;
    let captain = true;
    let customer;
    for (let cust of customers) {
      if (
        Number(cust.table) == Number(table) &&
        (type ? cust.type == type : true)
      ) {
        if (cust.restore) {
          break;
        } else if (cust.captain_id && cust.captain_id != req.user.id) {
          captain = false;
          break;
        }
        customer = cust;
        valid = true;
      }
    }

    if (!captain) {
      return res
        .status(403)
        .json({ success: false, message: status.INVALID_CAPTAIN });
    }

    if (!valid) {
      return res
        .status(403)
        .json({ success: false, message: status.UNAUTHORIZED });
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
      }

      if (!data.restore && data.cid && data.cid != customer.cid) {
        return res
          .status(403)
          .json({ success: false, message: status.INVALID_TABLE });
      }
    }

    let send_data;
    req.body.date = moment().utcOffset(process.env.UTC_OFFSET).unix();
    req.body.table = table;

    if (orderData.length == 0) {
      if (restorAble) {
        send_data = {
          cid: customer.cid,
          cname: customer.cname,
          order: [{ ...req.body }],
          restore: false,
          type: type || "",
        };
      } else {
        req.body.id = await generateRandomString();
        send_data = {
          cid: customer.cid,
          cname: customer.cname,
          type: type || "",
          order: [{ ...req.body }],
        };
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

    if (customer.cid.length != 12) {
      let customerDoc = await CustomerModel.findOne({
        _id: customer.cid,
      });

      if (!customerDoc) {
        return res
          .status(403)
          .json({ success: false, message: "No Customer Found" });
      }

      let index = customerDoc.rest_details
        .map((e) => {
          return e.rest_id;
        })
        .indexOf(req.user.rest_id);

      if (index != -1) {
        let date = moment()
          .utcOffset(process.env.UTC_OFFSET)
          .format("YYYY-MM-DD");

        let start_date = moment(date, "YYYY-MM-DD");
        let end_date = moment(
          customerDoc.rest_details[index].last_visit,
          "YYYY-MM-DD"
        );
        let m_visit = 1;
        let days = Number(start_date.diff(end_date, "days"));
        if (days <= 31) {
          m_visit = Number(customerDoc.rest_details[index].m_visit) + 1;
        }
        let custObj = {
          last_visit: date,
          visit: Number(customerDoc.rest_details[index].visit) + 1,
          m_visit: m_visit,
        };

        send_data.unique = true;
        await CustomerModel.updateOne(
          {
            _id: customer.cid,
            "rest_details.rest_id": req.user.rest_id,
          },
          {
            $set: {
              "rest_details.$.last_visit": custObj.last_visit,
              "rest_details.$.visit": custObj.visit,
              "rest_details.$.m_visit": custObj.m_visit,
            },
          }
        );
      } else {
        let custObj = {
          rest_id: req.user.rest_id,
          last_visit: moment()
            .utcOffset(process.env.UTC_OFFSET)
            .format("YYYY-MM-DD"),
          visit: 1,
          m_visit: 1,
        };
        await CustomerModel.findByIdAndUpdate(customer.cid, {
          $push: { rest_details: { ...custObj } },
        });
      }
    }

    orderRef.set(send_data, { merge: true }).then(async (order) => {
      return res
        .status(200)
        .json({ success: true, message: "Your order is successfully placed" });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `captain order addOrder captain: ${req.user.id} rest: ${req.user.rest_id}`,
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
