const sharp = require("sharp");
const path = require("path");

// חשוב: הנתיב היחסי הוא מתוך client/scripts
const input = path.join(__dirname, "../public/favicon.png");

async function run() {
  await sharp(input)
    .resize(192, 192)
    .png()
    .toFile(path.join(__dirname, "../public/favicon-192.png"));

  await sharp(input)
    .resize(512, 512)
    .png()
    .toFile(path.join(__dirname, "../public/favicon-512.png"));

  console.log("favicons generated ✅");
}

run().catch(console.error);
