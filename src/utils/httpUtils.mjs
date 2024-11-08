import https from "node:https";
import http from "node:http";
import fs from "fs";
import path from "path";

import { sleep } from "../utils/sleepUtils.mjs";

// function downloadImage(
//   imageUrl,
//   folderPath,
//   index,
//   attempt = 1,
//   maxRetries = 3
// ) {
//   return new Promise((resolve, reject) => {
//     const parsedUrl = new URL(imageUrl);
//     const imageFilePath = path.join(folderPath, `image${index}.jpg`);
//     const imageFile = fs.createWriteStream(imageFilePath);
//     const protocol = parsedUrl.protocol === "https:" ? https : http;

//     const handleError = (error) => {
//       fs.unlink(imageFilePath, () => reject(error));
//     };

//     const handleResponse = (response) => {
//       if (response.statusCode === 200) {
//         response.pipe(imageFile);
//         imageFile.on("finish", () =>
//           imageFile.close(() => resolve(imageFilePath))
//         );
//       } else {
//         handleError(new Error(`Failed to download image: ${imageUrl}`));
//       }
//     };

//     protocol.get(imageUrl, handleResponse).on("error", handleError);

//     imageFile.on("error", async (error) => {
//       if (attempt < maxRetries) {
//         console.log(`Retrying download (attempt ${attempt}): ${imageUrl}`);
//         await sleep(2000);
//         return downloadImage(
//           imageUrl,
//           folderPath,
//           index,
//           attempt + 1,
//           maxRetries
//         );
//       } else {
//         reject(error);
//       }
//     });
//   });
// }

// export { downloadImage };
export function downloadImage(imageUrl, folderPath, index, attempt = 1, maxRetries = 3) {
  return new Promise((resolve, reject) => {
    const parsedUrl = new URL(imageUrl);
    const imageFilePath = path.join(folderPath, `image${index}.jpg`);

    if (fs.existsSync(imageFilePath)) {
      return resolve(imageFilePath);
    }

    const imageFile = fs.createWriteStream(imageFilePath);
    const protocol = parsedUrl.protocol === "https:" ? https : http;

    const handleError = (error) => {
      fs.unlink(imageFilePath, () => reject(error));
    };

    const handleResponse = (response) => {
      if (response.statusCode === 200) {
        response.pipe(imageFile);
        imageFile.on("finish", () => imageFile.close(() => resolve(imageFilePath)));
      } else {
        handleError(new Error(`Не удалось загрузить изображение: ${imageUrl}`));
      }
    };

    protocol.get(imageUrl, handleResponse).on("error", handleError);

    imageFile.on("error", async (error) => {
      if (attempt < maxRetries) {
        console.log(`Повторная загрузка (attempt ${attempt}): ${imageUrl}`);
        await sleep(2000);
        return downloadImage(imageUrl, folderPath, index, attempt + 1, maxRetries);
      } else {
        reject(error);
      }
    });
  });
}
