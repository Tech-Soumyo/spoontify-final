interface Color {
  r: number;
  g: number;
  b: number;
  a: number;
  brightness: number;
  gradient: string;
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

      // Set canvas size to 2x2 to get a better color sample
      canvas.width = 2;
      canvas.height = 2;

      // Draw image into canvas and scale it down
      context.drawImage(image, 0, 0, 2, 2);
      const data = context.getImageData(0, 0, 2, 2).data;
      const r = data[0] || 0;
      const g = data[1] || 0;
      const b = data[2] || 0;
      const a = data[3] || 0;

      // Calculate brightness using perceived brightness formula
      const brightness = (0.299 * r + 0.587 * g + 0.114 * b) / 255;

      // Create a gradient string with the color
      const gradient = `linear-gradient(135deg, 
        rgba(${r}, ${g}, ${b}, 0.8) 0%, 
        rgba(${r}, ${g}, ${b}, 0.4) 50%, 
        rgba(${r}, ${g}, ${b}, 0.2) 100%)`;

      resolve({
        r: Number(r) < 0 ? 0 : Number(r),
        g: Number(g) < 0 ? 0 : Number(g),
        b: Number(b) < 0 ? 0 : Number(b),
        a: Number(a) < 0 ? 0 : Number(a),
        brightness,
        gradient,
      });
    } catch (error) {
      reject(error);
    }
  });
}
