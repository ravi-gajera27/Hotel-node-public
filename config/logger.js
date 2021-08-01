const { createLogger, format, transports } = require('winston')
const { combine, timestamp, label, prettyPrint } = format
require('winston-mongodb')

let logger = null

if (process.env.NODE_ENV == 'prod') {
  try {
    logger = createLogger({
      transports: [
        new transports.MongoDB({
          db: process.env.MONGODB_URL,
          level: 'info',
          format: combine(label, timestamp(), format.json()),
          options: { useUnifiedTopology: true },
        }),
      ],
    })
  } catch (e) {
    let ew = new Error(e)
    console.log(ew.message)
  }
} else if (process.env.NODE_ENV == 'dev') {
  console.log('calll')
  try {
    logger = createLogger({
      level: 'info',
      format: combine(timestamp(), prettyPrint()),
      transports: [
        new transports.File({ filename: 'public/log' }),
        new transports.Console(),
      ],
    })
  } catch (e) {
    let ew = new Error(e)
    console.log(ew.message)
  }
}

module.exports = logger
