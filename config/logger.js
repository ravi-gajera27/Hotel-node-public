const { createLogger, format, transports } = require('winston')
const { combine, timestamp, label, prettyPrint } = format
require('winston-mongodb')

const logger = createLogger({
  transports: [
    new transports.MongoDB({
      db: process.env.MONGODB_URL,
      level: 'info',
      format: combine(timestamp(), format.json()),
      options: {useUnifiedTopology: true}
    }),
  ],
})

module.exports = logger
