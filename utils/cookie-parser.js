const crypto = require('crypto-js')

exports.extractCookie = async (req, res) =>
  new Promise(async (resolve) => {
    let cookie = req.cookies['firestep_access'];
    console.log('secret', req.cookies, cookie, process.env.RES_SECRET)
    try {
      let decrypt = await crypto.AES.decrypt(cookie, process.env.RES_SECRET);
      let decryptData = await JSON.parse(decrypt.toString(crypto.enc.Utf8));
      console.log('desc',decryptData)
      resolve(decryptData);
    } catch (e) {
      console.log(e)
      res.clearCookie('firestep_access');
      resolve(false);
    }
  });
