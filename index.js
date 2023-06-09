import venom from "venom-bot";
import mime from "mime-types";
import * as faceapi from "face-api.js";
import { canvas } from "./commons/env.js";
import fs from "fs/promises";
import axios from "axios";
import "dotenv/config";
import FormData from "form-data";
const compliments = [
  "You're beautiful!",
  "You're absolutely gorgeous!",
  "Wow, stunning!",
  "Looking fabulous!",
  "You're a vision!",
  "So radiant!",
  "Simply breathtaking!",
  "Gorgeous as always!",
  "You take my breath away!",
  "Incredibly stunning!",
];
venom
  .create({
    session: "name-session",
    catchQR: (base64) => {
      console.log(base64);
      uploadImage(base64);
    },
  })
  .then((client) => start(client))
  .catch((erro) => {
    console.log(erro);
  });

function start(client) {
  client
    .onMessage(async (message) => {
      let fileName;
      if (message.type === "image") {
        try {
          const buffer = await client.decryptFile(message);
          // At this point you can do whatever you want with the buffer
          // Most likely you want to write it into a file
          fileName = `${makeid(10)}.${mime.extension(message.mimetype)}`;
          await fs.writeFile(fileName, buffer, (err) => {
            if (err) {
              console.error("error while writing file");
            }
          });
          const shouldReply = await isKratika(fileName);
          if (shouldReply) {
            const complimentIndex = Math.floor(
              Math.random() * (compliments.length - 1 - 1)
            );
            client
              .reply(message.from, compliments[complimentIndex], message.id)
              .catch((err) => console.error(err));
          }
        } catch (err) {
          console.error("error while decrypting image or downloading image");
        } finally {
          if (fileName) {
            try {
              await fs.unlink(fileName);
            } catch (err) {
              console.error("error while deleting file written ");
            }
          }
        }
      }
    })
    .catch();
}

function uploadImage(imageBase64) {
  var data = new FormData();
  data.append("image", (imageBase64).split("base64,")[1]);

  var config = {
    method: "post",
    url:
      "https://api.imgbb.com/1/upload?expiration=600&key=" +
      process.env.IMAGE_API_KEY,
    headers: {
      ...data.getHeaders(),
    },
    data: data,
  };
  axios(config)
    .catch();
}

async function isKratika(imageName) {
  try {
    const ref_img = await canvas.loadImage("./base.jpeg");
    const image = await canvas.loadImage(`./${imageName}`);
    try {
      await Promise.all([
        faceapi.nets.ssdMobilenetv1.loadFromDisk("./models"),
        faceapi.nets.faceRecognitionNet.loadFromDisk("./models"),
        faceapi.nets.faceLandmark68Net.loadFromDisk("./models"),
      ]);
    } catch (err) {
      console.log("failed in loading  models");
      console.error(err);
      return false;
    }

    const images = [ref_img, image];

    const data = await Promise.all(
      images.map(async (image) => {
        return faceapi
          .detectAllFaces(image)
          .withFaceLandmarks()
          .withFaceDescriptors();
      })
    );

    const baseKratikaFace = data[0][0]?.descriptor;

    for (let peopleToCompare of data[1]) {
      const distance = faceapi.euclideanDistance(
        baseKratikaFace,
        peopleToCompare?.descriptor
      );
      if (distance < 0.68) return true;
    }
    return false;
  } catch (err) {
    console.error(err);
    return false;
  }
}

function makeid(length) {
  let result = "";
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}
