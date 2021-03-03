const extractCookie = async (req) =>
  new Promise(async (resolve) => {
    let cookie = req.cookies['firestep_access'];
    try {
      let decrypt = await crypto.AES.decrypt(cookie, process.env.RES_SECRET);
      let decryptData = await JSON.parse(decrypt.toString(crypto.enc.Utf8));
      resolve(decryptData);
    } catch (e) {
      res.clearCookie('firestep_access');
      resolve(false);
    }
  });
