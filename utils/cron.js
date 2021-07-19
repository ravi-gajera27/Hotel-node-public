const cron = require('node-cron');

let invoiceCron = cron.schedule(process.env.INVOICE_CRON, function() {

  }, {scheduled: true, timezone: process.env.TIMEZONE});
  

let lockedCron = cron.schedule(process.env.LOCKED_CRON, function() {
   
      }, {scheduled: true, timezone: process.env.TIMEZONE});
      

exports.startInvoiceCron = async()=>{
    invoiceCron.start();
}  

exports.stopInvoiceCron = async()=>{
    invoiceCron.stop();
}

exports.startLockedCron = async()=>{
    lockedCron.start();
}  

exports.stopLockedCron = async()=>{
    lockedCron.stop();
}