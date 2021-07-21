const cron = require('node-cron')
const payment = require('../super-admin/controllers/payment')

let invoiceCron = cron.schedule(
  process.env.INVOICE_CRON,
  async function () {
    await payment.generateInvoice()
  },
  { scheduled: true, timezone: process.env.TIMEZONE },
)

let lockedCron = cron.schedule(
  process.env.LOCKED_CRON,
  async function () {
    await payment.lockedRestaurant()
  },
  {
    scheduled: true,
    timezone: process.env.TIMEZONE,
  },
)

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
