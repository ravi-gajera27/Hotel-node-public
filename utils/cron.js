const cron = require('node-cron')
const logger=require('../config/logger')
const payment = require('../super-admin/controllers/payment')
const { resetAll }=require('./zone')

let invoiceCron = cron.schedule(
  process.env.INVOICE_CRON,
  async function () {
    try{
    await payment.generateInvoice()
    }catch(err){
      let e = extractErrorMessage(err)
    logger.error({
      label: `utils cron invoiceCron`,
      message: e,
    })
    }
  },
  { scheduled: true, timezone: process.env.TIMEZONE },
)

let lockedCron = cron.schedule(
  process.env.LOCKED_CRON,
  async function () {
    try{
    await payment.lockedRestaurant()
    }catch(err){
      let e = extractErrorMessage(err)
    logger.error({
      label: `utils cron lockedCron`,
      message: e,
    })
    }
  },
  {
    scheduled: true,
    timezone: process.env.TIMEZONE,
  },
)

let zoneCron = cron.schedule(process.env.ZONE_CRON, async () => {
  try{
    await resetAll();
  }catch(err){
    let e = extractErrorMessage(err)
    logger.error({
      label: `utils cron zoneCron`,
      message: e,
    })
  }
})

exports.startInvoiceCron = async () => {
  invoiceCron.start()
}

exports.stopInvoiceCron = async () => {
  invoiceCron.stop()
}

exports.startLockedCron = async () => {
  lockedCron.start()
}

exports.stopLockedCron = async () => {
  lockedCron.stop()
}

exports.startAllCron = async () => {
  invoiceCron.start()
  lockedCron.start()
  zoneCron.start()
}

exports.stopAllCron = async () => {
  invoiceCron.stop()
  lockedCron.stop()
  zoneCron.stop()
}