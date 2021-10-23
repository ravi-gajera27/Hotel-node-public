const crypto = require("crypto-js");

exports.extractCookie = async (req, res) =>
  new Promise(async (resolve) => {
    let cookie;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith("Bearer")
    ) {
      cookie = req.headers.authorization.split(" ")[2];
    }
    if (!cookie) {
      resolve(false);
    }
    try {
      var key = crypto.enc.Hex.parse(`${process.env.QR_SECRET}`);
      var iv = crypto.enc.Hex.parse(
        `${process.env.QR_SECRET.toString().split('').reverse().join('')}`
      );
      let decrypt = await crypto.AES.decrypt(cookie, key,{
        mode: crypto.mode.CTR,
        padding: crypto.pad.NoPadding,
        iv: iv,
      });
      let decryptData = await JSON.parse(decrypt.toString(crypto.enc.Utf8));
      resolve(decryptData);
    } catch (e) {
      console.log(e);
      res.clearCookie("hungercodes_access");
      resolve(false);
    }
  });
