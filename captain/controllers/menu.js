const firstore = require('../../config/db').firestore()
const status = require('../../utils/status')
const { extractErrorMessage } = require('../../utils/error')
const logger = require('../../config/logger')

exports.getMenu = async (req, res, next) => {
    try {
      let menuDoc = await firstore
        .collection('restaurants')
        .doc(req.user.rest_id)
        .collection('menu')
        .doc('menu')
        .get()
  
      let menu = []
      if (menuDoc.exists) {
        menu = menuDoc.data().menu
      }
  
      res.status(200).json({ success: true, data: menu })
    } catch (err) {
      let e = extractErrorMessage(err)
      logger.error({
        label: `captain menu getMenu ${req.user.rest_id}`,
        message: e,
      })
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR })
    }
  }