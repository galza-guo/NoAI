const { Jimp } = require('jimp');
// If Jimp v1, it's const Jimp = require('jimp');
// Let's try standard import
const JimpLib = require('jimp');
const JimpObj = JimpLib.Jimp || JimpLib;

async function main() {
  try {
    const image = await JimpObj.read('/Users/guolite/GitHub/NoAI/public/logo.png');
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      if (red > 240 && green > 240 && blue > 240) {
        this.bitmap.data[idx + 3] = 0;
      }
    });
    // For Jimp v1: await image.writeAsync(...). For v0: image.write(...)
    if (image.writeAsync) {
        await image.writeAsync('/Users/guolite/GitHub/NoAI/public/logo.png');
    } else {
        await image.write('/Users/guolite/GitHub/NoAI/public/logo.png');
    }
    console.log("Image alpha processed successfully.");
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

main();
