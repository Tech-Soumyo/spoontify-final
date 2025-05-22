interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
}

export function getAverageColor(image: HTMLImageElement): Promise<Color> {
  return new Promise((resolve, reject) => {
    try {
      const canvas = document.createElement("canvas");
      const context = canvas.getContext("2d");

      if (!context) {
        reject(new Error("Could not get canvas context"));
        return;
      }

      // Set canvas size to 1x1 as we just need the average color
      canvas.width = 1;
      canvas.height = 1;

      // Draw image into canvas and scale it down to 1x1
      context.drawImage(image, 0, 0, 2, 2); // Get pixel data
      const [r, g, b, a] = context.getImageData(0, 0, 2, 2).data;

      resolve({
        r: Number(r) < 0 ? 0 : Number(r),
        g: Number(g) < 0 ? 0 : Number(g),
        b: Number(b) < 0 ? 0 : Number(b),
        a: Number(a) < 0 ? 0 : Number(a),
      });
    } catch (error) {
      reject(error);
    }
  });
}
