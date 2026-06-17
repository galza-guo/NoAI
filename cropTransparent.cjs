const JimpLib = require('jimp');
const JimpObj = JimpLib.Jimp || JimpLib;

async function main() {
  try {
    const image = await JimpObj.read('/Users/guolite/GitHub/NoAI/public/logo.png');
    
    let minX = image.bitmap.width;
    let minY = image.bitmap.height;
    let maxX = 0;
    let maxY = 0;

    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const alpha = this.bitmap.data[idx + 3];
      if (alpha > 10) { 
        if (x < minX) minX = x;
        if (y < minY) minY = y;
        if (x > maxX) maxX = x;
        if (y > maxY) maxY = y;
      }
    });

    minX = Math.max(0, minX - 4);
    minY = Math.max(0, minY - 4);
    maxX = Math.min(image.bitmap.width - 1, maxX + 4);
    maxY = Math.min(image.bitmap.height - 1, maxY + 4);

    const width = maxX - minX + 1;
    const height = maxY - minY + 1;

    console.log(`Cropping to: x=${minX}, y=${minY}, w=${width}, h=${height}`);
    
    // Support both older and newer Jimp APIs
    try {
        image.crop({ x: minX, y: minY, w: width, h: height });
    } catch (e) {
        image.crop(minX, minY, width, height);
    }

    if (image.writeAsync) {
        await image.writeAsync('/Users/guolite/GitHub/NoAI/public/logo.png');
    } else {
        await image.write('/Users/guolite/GitHub/NoAI/public/logo.png');
    }
    console.log("Image robustly cropped successfully.");
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

main();
