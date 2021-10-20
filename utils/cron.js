const cron = require('node-cron')
const logger=require('../config/logger')
const payment = require('../super-admin/controllers/payment')
const { resetAll }=require('./zone')

let lockedCron = cron.schedule(
  process.env.LOCKED_CRON,
  async function () {
    try{
      console.log('calll locked cron')
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
},
{
  scheduled: true,
  timezone: process.env.TIMEZONE,
},)


exports.startLockedCron = async () => {
  lockedCron.start()
}

exports.stopLockedCron = async () => {
  lockedCron.stop()
}

exports.startAllCron = async () => {
  console.log('start all cron')
  lockedCron.start()
  zoneCron.start()
}

exports.stopAllCron = async () => {
  lockedCron.stop()
  zoneCron.stop()
}