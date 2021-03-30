const firstore = require("../../config/db").firestore();
const status = require("../../utils/status");
const HASH = require("../../utils/encryption");
const TOKEN = require("../../utils/token");
const { google } = require("googleapis");
const oauth = require("../../config/googleDrive");
const compress_images = require("compress-images");
const fs = require("fs");
const path = require("path");

var credentials = require("../../peraket-rms-google-drive.json");
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
    console.log("err", err);
  } else {
    drive = google.drive({
      version: "v3",
      auth: oAuthClient,
    });
  }
});

exports.getCategory = async (req, res, next) => {
  await firstore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("categories")
    .get()
    .then((cat) => {
      let data = {};
      cat.docs.map((e) => {
        data.cat = e.data().cat;
        data.id = e.id;
      });
      res.status(200).json({ success: true, data: data });
    })
    .catch((err) => {
      res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.setCategory = async (req, res, next) => {
  await firstore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("categories")
    .doc(req.params.id)
    .set({ cat: [...req.body] }, { merge: true })
    .then((cat) => {
      res.status(200).json({ success: true, data: cat });
    })
    .catch((err) => {
      res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.getMenu = async (req, res, next) => {
  await firstore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("menu")
    .get()
    .then((menu) => {
      let data = [];
      menu.docs.map((ele) => {
        let temp = ele.data();
        temp.id = ele.id;
        data.push(temp);
      });
      res.status(200).json({ success: true, data: data });
    })
    .catch((err) => {
      res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.addMenu = async (req, res, next) => {
  await firstore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("menu")
    .add(req.body)
    .then((menu) => {
      res.status(200).json({ success: true, data: menu });
    })
    .catch((err) => {
      res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.updateMenu = async (req, res, next) => {
  let photo = "";
  let menu_id = "";
  let data = JSON.parse(req.body.data);
  if (req.files && req.files.menu_pic != "undefined") {
    photo = req.files.menu_pic;

    if (!photo.mimetype.startsWith("image")) {
      return res
        .status(400)
        .json({ success: false, err: "Please upload an valid image file" });
    }

    if (photo.size > process.env.MAX_FILE_UPLOAD) {
      return res
        .status(400)
        .json({ success: false, err: "Please upload an image less than 1MB" });
    }

    photo.name = `Img-${Date.now()}${path.parse(photo.name).ext}`;
    let path_name = `${process.env.FILE_UPLOAD_PATH}/${photo.name}`;
    let output_path = `${process.env.FILE_BUILD_PATH}/${photo.name}`;

    await photo.mv(path_name, async (err) => {
      if (err) {
        return res
          .status(500)
          .json({ success: false, err: "Problem With image upload" });
      } else {
        let img = await compressImage(path_name);

        const fileMetadata = {
          name: photo.name,
          parents: ["15Gzb1kyQF7QFmpoqLfvipETYnURMb_Ev"],
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
              // Handle error
              console.error(err);
            } else {
              console.log(file);
              data.img_url = file.data.id;
              updateMenuFun(req, res, data);
            }
          }
        );
        fs.unlinkSync(path_name);
        fs.unlinkSync(output_path);
      }
    });
  } else {
    updateMenuFun(req, res, data);
  }
};

updateMenuFun = async (req, res, data) => {
  delete data.id;
  await firstore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("menu")
    .doc(req.params.id)
    .set(data, { merge: true })
    .then((d) => {
      res.status(200).json({ success: true, data: data });
    })
    .catch((err) => {
      res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

exports.deleteMenu = async (req, res, next) => {
  await firstore
    .collection("restaurants")
    .doc(req.user.rest_id)
    .collection("menu")
    .doc(req.params.id)
    .delete()
    .then((menu) => {
      res.status(200).json({ success: true, data: menu });
    })
    .catch((err) => {
      res.status(500).json({ success: false, err: status.SERVER_ERROR });
    });
};

compressImage = async (path) => {
  return new Promise((resolve, reject) => {
    compress_images(
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
        console.log(statistic);
        if (completed === true) {
          resolve(true);
        } else {
          resolve(false);
        }
      }
    );
  });
};
