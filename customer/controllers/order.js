const firstore = require('../../config/db').firestore();
const status = require('../../utils/status');


exports.addOrder = async (req, res, next) => {
  let user = req.user.id;
  let cookie = await extractCookie(req);

  if (!cookie) {
    res.status(401).json({ success: false, err: status.UNAUTHORIZED });
  }

  let orderRef = await firstore
    .collection(`${cookie.rest_id}/order/table/`)
    .doc(`${cookie.table}`)
   
    let order = await orderRef.get()

    let orderData = []
  if (order.exists) {
    let data = order.data();
    orderData = data.order
    if (data.user_id != req.user.id) {
      res.status(401).json({ success: false, err: SESSION_EXIST });
    }
  }

  let send_data
  if(orderData.length == 0){
    send_data = {user: req.user.id, name: req.user.name, order: req.body}
  }
  else{
    orderData.push(req.body)
    send_data = orderDate 
  }
  orderRef.set(send_data, {merge: true})
  .then(order => {
      res.status(200).json({success: true, message: 'Order is successfully placed !'})
  }).catch(err => {
    return res.status(500).json({ success: false, err: status.SERVER_ERROR });
  })

};
