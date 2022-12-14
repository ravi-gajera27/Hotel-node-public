const firestore = require("../../config/db").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const { google } = require("googleapis");
const oauth = require("../../config/googleDrive");
const compress_images = require("compress-images");
const fs = require("fs");
const path = require("path");
const randomstring = require("randomstring");
const sizeof = require("firestore-size");
var credentials =
  process.env.NODE_ENV != "prod"
    ? require("../../peraket-rms-google-drive.json")
    : require("../../hungercodes-google-drive.json");
const { extractErrorMessage } = require("../../utils/error");
const logger = require("../../config/logger");

let scopes = ["https://www.googleapis.com/auth/drive"];

let oAuthClient = new google.auth.JWT(
  credentials.client_email,
  null,
  credentials.private_key,
  scopes
);

let drive;

oAuthClient.authorize((err, token) => {
  if (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin menu googleDrive auth`,
      message: e,
    });
  } else {
    drive = google.drive({
      version: "v3",
      auth: oAuthClient,
    });
  }
});

exports.getCategory = async (req, res, next) => {
  await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("categories")
    .get()
    .then((cat) => {
      if (!cat.empty) {
        let data = {};
        cat.docs.map((e) => {
          data.cat = e.data().cat;
          data.id = e.id;
        });
        res.status(200).json({ success: true, data: data });
      } else {
        res.status(200).json({ success: true, data: { cat: [], id: "" } });
      }
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `admin menu getCategory ${req.user.rest_id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.setCategory = async (req, res, next) => {
  await firestore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("menu")
    .doc("menu")
    .set({ cat: [...req.body] }, { merge: true })
    .then((cat) => {
      res.status(200).json({
        success: true,
        message: status.SUCCESS_ADDED,
      });
    })
    .catch((err) => {
      let e = extractErrorMessage(err);
      logger.error({
        label: `admin menu setCategory ${req.user.rest_id}`,
        message: e,
      });
      return res
        .status(500)
        .json({ success: false, message: status.SERVER_ERROR });
    });
};

exports.getMenu = async (req, res, next) => {
  try {
    let menuDoc = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("menu")
      .doc("menu")
      .get();

    let menu = [];
    let cat = [];
    if (menuDoc.exists) {
      menu = menuDoc.data().menu;
      cat = menuDoc.data().cat;
    }
    res.status(200).json({ success: true, data: { menu: menu, cat: cat } });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin menu getMenu ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.addMenu = async (req, res, next) => {
  try {
    let data = JSON.parse(req.body.data);
    if (req.files && req.files.menu_pic != "undefined") {
      let { success, err, id } = await extractImage(
        req,
        res,
        process.env.MENU_DRIVE_PARENT
      );
      if (success) {
        data.img_url = id;
      } else {
        return res.status(500).json({ success: false, message: err });
      }
    }

    let menuRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("menu")
      .doc("menu");

    let menuData = await menuRef.get();

    let menu = [];

    if (!menuData.exists) {
      let id = await generateRandomString();
      data.id = id;
      data.push(data);
    } else {
      let tempMenu = menuData.data().menu;

      valid = false;
      let id;
      do {
        id = await generateRandomString();
        valid = false;
        for (let menu of tempMenu) {
          if (menu.id == id) {
            valid = true;
            break;
          }
        }
      } while (valid);

      data.id = id;
      tempMenu.push(data);

      menu = [...tempMenu];
    }

    await menuRef.set({ menu: [...menu] }, { merge: true }).then((menu) => {
      res
        .status(200)
        .json({ success: true, data: data, message: status.SUCCESS_ADDED });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin menu addMenu ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

/* exports.addMenuFile = async (req, res, next) => {
  try {
    let menuRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("menu")
      .doc("menu");

    let menuData = await menuRef.get();

    let menu = [];

    if (!menuData.exists) {
      menu = [];
    } else {
      menu = menuData.data().menu;
    }
    for (let ele of req.body) {
      valid = false;
      let id;
      do {
        id = await generateRandomString();
        valid = false;
        for (let m of menu) {
          if (m.id == id) {
            valid = true;
            break;
          }
        }
      } while (valid);

      ele.id = id;
      menu.push(ele);
    }

    await menuRef.set({ menu: [...menu] }).then((e) => {
      res.status(200).json({ success: true, message: status.SUCCESS_ADDED });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin menu addMenuFile ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
}; */

exports.updateMenu = async (req, res, next) => {
  try {
    let data = JSON.parse(req.body.data);

    let menuRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("menu")
      .doc("menu");

    let menuData = await menuRef.get();

    let menu = menuData.data().menu;

    let index = menu
      .map((ele) => {
        return ele.id;
      })
      .indexOf(data.id);

    if (index == -1) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    if (req.files && req.files.menu_pic != "undefined") {
      if (menu[index].img_url) {
        await removeImage(menu[index].img_url);
      }
      let { success, err, id } = await extractImage(
        req,
        res,
        process.env.MENU_DRIVE_PARENT
      );
      if (success) {
        data.img_url = id;
      } else {
        return res.status(500).json({ success: false, message: err });
      }
    }

    if (data.type && data.type.length >= 2) {
      delete data.price;
      delete data.disPrice;
    }
    menu[index] = data;

    await menuRef.set({ menu: [...menu] }, { merge: true }).then((e) => {
      res.status(200).json({ success: true, message: status.SUCCESS_UPDATED });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin menu updateMenu ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.deleteMenu = async (req, res, next) => {
  try {
    let id = req.params.id;

    let menuRef = await firestore
      .collection("restaurants")
      .doc(req.user.rest_id)
      .collection("menu")
      .doc("menu");

    let menuData = await menuRef.get();

    let menu = menuData.data().menu;

    let index = menu
      .map((ele) => {
        return ele.id;
      })
      .indexOf(id);

    if (index == -1) {
      return res
        .status(400)
        .json({ success: false, message: status.BAD_REQUEST });
    }

    if (menu[index].img_url) {
      let img = await removeImage(menu[index].img_url);
    }

    menu.splice(index, 1);

    await menuRef.set({ menu: [...menu] }, { merge: true }).then((e) => {
      res.status(200).json({ success: true, message: status.SUCCESS_REMOVED });
    });
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin menu deleteMenu ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

exports.updateLogo = async (req, res) => {
  try {
    let restDoc = firestore.collection("restaurants").doc(req.user.rest_id);
    let restDetails = await restDoc.get();

    restDetails = restDetails.data();

    if (req.files && req.files.logo != "undefined") {
      if (restDetails.logo) {
        await removeImage(restDetails.logo);
      }
      let { success, err, id } = await extractImage(
        req,
        res,
        process.env.LOGO_DRIVE_PARENT
      );
      if (success) {
        await restDoc.set({ logo: id }, { merge: true });
        return res
          .status(200)
          .json({ success: true, message: "Successfully changed", logo: id });
      } else {
        return res.status(500).json({ success: false, message: err });
      }
    } else {
      return res
        .status(400)
        .json({ success: false, message: "Please upload logo" });
    }
  } catch (err) {
    let e = extractErrorMessage(err);
    logger.error({
      label: `admin menu updateLogo ${req.user.rest_id}`,
      message: e,
    });
    return res
      .status(500)
      .json({ success: false, message: status.SERVER_ERROR });
  }
};

extractImage = async (req, res, parent) => {
  return new Promise(async (resolve, reject) => {
    photo = req.files.menu_pic || req.files.logo;

    if (!photo.mimetype.startsWith("image")) {
      resolve({ success: false, message: "Please upload an valid image file" });
    }

    photo.name = `Img-${Date.now()}${path.parse(photo.name).ext}`;
    let path_name = `${process.env.FILE_UPLOAD_PATH}/${photo.name}`;
    let output_path = `${process.env.FILE_BUILD_PATH}/${photo.name}`;

    await photo.mv(path_name, async (err) => {
      if (err) {
        let e = extractErrorMessage(err);
        logger.error({ label: "admin menu extractImage", message: e });
        resolve({ success: false, message: "Problem with image upload" });
      } else {
        let img = await compressImage(path_name);
    
        if (!img) {
          return resolve(img);
        }
        const fileMetadata = {
          name: photo.name,
          parents: [`${parent}`],
        };
        const media = {
          mimeType: photo.mimetype,
          body: fs.createReadStream(output_path),
        };

        await drive.files.create(
          {
            resource: fileMetadata,
            media: media,
          },
          (err, file) => {
            if (err) {
              fs.unlinkSync(path_name);
              fs.unlinkSync(output_path);

              let e = extractErrorMessage(err);
              logger.error({ label: "admin menu extractImage", message: e });
              resolve({ success: false, message: "Problem with image upload" });
            } else {
         
              fs.unlinkSync(path_name);
              fs.unlinkSync(output_path);
              resolve({ success: true, id: file.data.id });
            }
          }
        );
      }
    });
  });
};

removeImage = async (id) => {
  return new Promise(async (resolve, reject) => {
    await drive.files
      .delete({
        fileId: id,
      })
      .then((res) => {
        resolve(true);
      });
  });
};

compressImage = async (path) => {
  return new Promise(async (resolve, reject) => {
    await compress_images(
      path,
      `${process.env.FILE_BUILD_PATH}/`,
      { compress_force: true, statistic: true, autoupdate: true },
      false,
      { jpg: { engine: "mozjpeg", command: ["-quality", "60"] } },
      { png: { engine: "pngquant", command: ["--quality=20-50", "-o"] } },
      { svg: { engine: "svgo", command: "--multipass" } },
      {
        gif: {
          engine: "gifsicle",
          command: ["--colors", "64", "--use-col=web"],
        },
      },
      function (error, completed, statistic) {
        if (completed === true) {
          resolve(true);
        } else {
          let e = extractErrorMessage(error);
          logger.error({ label: "admin menu compressImage", message: e });
          resolve({ success: false, message: "Problem with compress image" });
        }
      }
    );
  });
};

async function generateRandomString() {
  return await randomstring.generate({
    length: 12,
    charset: "alphabetic",
  });
}
