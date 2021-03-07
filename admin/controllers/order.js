const firstore = require('../../config/db').firestore();
const status = require('../../utils/status');
const HASH = require('../../utils/encryption');
const TOKEN = require('../../utils/token');

exports.cancelOrder = async (req, res, next) => {
  let table_no = req.params.table_no;
  let order_no = req.params.oreder_no;

  if (!table_no || !order_no) {
    return res.status(400).json({ status: false, err: status.BAD_REQUEST });
  }

  let orderRef = firstore
    .collection(`restaurants/${req.user.rest_id}/order`)
    .doc(`table-${table_no}`);

  let orderData = await orderRef.get();
  if (orderData.exists) {
    let order = JSON.parse(JSON.stringify(orderData.order));
    if (Number(order_no) <= order.length) {
      order.splice(Number(table_no), 1);

      orderRef
        .set({ order: order }, { merge: true })
        .then((order) => {
          return res.status(200).json({
            success: true,
            message: `Table-${table_no} Order-${order_no} is successfully canceled`,
          });
        })
        .catch((err) => {
          return res
            .status(500)
            .json({ success: false, err: status.SERVER_ERROR });
        });
    } else {
      return res.status(400).json({ status: false, err: status.BAD_REQUEST });
    }
  }
  return res.status(400).json({ status: false, err: status.BAD_REQUEST });
};

exports.terminateSession = async (req, res, next) => {
  let table_no = req.params.table_no;

  if (!table_no) {
    return res.status(400).json({ status: false, err: status.BAD_REQUEST });
  }

  let orderRef = firstore
    .collection(`restaurants/${req.user.rest_id}/order`)
    .doc(`table-${table_no}`);

  await orderRef
    .delete()
    .then((ord) => {
      return res.status(200).json({
        success: true,
        message: `Sessoin from table-${table_no} is successfully terminated`,
      });
    })
    .catch((err) => {
      return res.status(500).json({ status: false, err: status.SERVER_ERROR });
    });
};

exports.checkoutCustomer = async (req, res, next) => {
    
};
