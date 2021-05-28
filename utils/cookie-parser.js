const crypto = require("crypto-js");

exports.extractCookie = async (req, res) => 
new Promise(async (resolve) => {
  console.log("cookies", req.cookies);
  let cookie = req.cookies.firestep_access;
/*   if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer")
  ) {
    cookie = req.headers.authorization.split(" ")[2];
  } */
/*   if (!cookie) {
    resolve(false);
  } */
  try {
    let decrypt = await crypto.AES.decrypt(cookie, process.env.RES_SECRET);
    let decryptData = await JSON.parse(decrypt.toString(crypto.enc.Utf8));
    console.log("desc", decryptData);
    resolve(decryptData);
  } catch (e) {
    console.log(e);
    res.clearCookie("firestep_access");
    resolve(false);
  }
});
