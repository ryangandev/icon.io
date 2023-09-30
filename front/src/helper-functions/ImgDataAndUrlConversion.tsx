const imageDataToDataURL = (imageData: ImageData): string => {
    const canvas = document.createElement('canvas');
    canvas.width = imageData.width;
    canvas.height = imageData.height;
    const ctx = canvas.getContext('2d')!;
    ctx.putImageData(imageData, 0, 0);
    return canvas.toDataURL();
};

// https://stackoverflow.com/questions/17591148/converting-data-uri-to-image-data
const dataURLToImageData = async (dataURL: string): Promise<ImageData> => {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = dataURL;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d')!;
            ctx.drawImage(img, 0, 0);
            const imageData = ctx.getImageData(
                0,
                0,
                canvas.width,
                canvas.height,
            );
            resolve(imageData);
        };
    });
};

export { imageDataToDataURL, dataURLToImageData };
