import Jimp from 'jimp';

async function main() {
  try {
    const image = await Jimp.read('/Users/guolite/GitHub/NoAI/public/logo.png');
    image.scan(0, 0, image.bitmap.width, image.bitmap.height, function(x, y, idx) {
      const red = this.bitmap.data[idx + 0];
      const green = this.bitmap.data[idx + 1];
      const blue = this.bitmap.data[idx + 2];
      
      if (red > 240 && green > 240 && blue > 240) {
        this.bitmap.data[idx + 3] = 0;
      }
    });
    // Newer Jimp might just use write
    await image.write('/Users/guolite/GitHub/NoAI/public/logo.png');
    console.log("Image alpha processed successfully.");
  } catch (err) {
    console.error("Error processing image:", err);
  }
}

main();
