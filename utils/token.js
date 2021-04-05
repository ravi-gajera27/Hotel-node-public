const jwt = require("jsonwebtoken");
const crypto = require("crypto-js");

const generateToken = async (data) => {
  console.log("token", data);
  try {
    token = await crypto.AES.encrypt(
      JSON.stringify(data),
      process.env.ENC_SECRET
    ).toString();
    return await jwt.sign({ token: token }, process.env.TOKEN_SECRET);
  } catch (e) {
    console.log("errr token", e);
  }
};

const verifyToken = async (token) =>
  new Promise(async (resolve) => {
    await jwt.verify(token, process.env.TOKEN_SECRET, async (err, decoded) => {
      if (err) {
        resolve(false);
      } else {
        try {
          let decrypt = await crypto.AES.decrypt(
            decoded.token,
            process.env.ENC_SECRET
          );
          let decryptData = await JSON.parse(decrypt.toString(crypto.enc.Utf8));
          console.log(decryptData);
          resolve(decryptData);
        } catch (e) {
          resolve(false);
        }
      }
    });
  });

module.exports = {
  generateToken,
  verifyToken,
};
