const bcrypt = require('bcrypt')

const generateHash = async (password, saltRounds) =>
  new Promise((resolve, reject) => {
    bcrypt.hash(password, saltRounds, (err, hash) => {
      if (!err) {
        console.log(hash)
        resolve(hash)
      }
      reject(err)
    })
  })

const verifyHash = async (password, hash) =>
  new Promise((resolve, reject) => {
    bcrypt.compare(password, hash, (err, result) => {
      if (result) {
        resolve(true)
      }
      resolve(false)
    })
  })

module.exports = { verifyHash, generateHash }
