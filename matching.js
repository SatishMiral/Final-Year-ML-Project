import fetch from 'node-fetch';
import { createCanvas, loadImage } from 'canvas';
import * as tf from '@tensorflow/tfjs';

async function loadImageFromUrl(url) {
    if (!url || !url.startsWith('http')) {
        throw new Error('Invalid or missing URL');
    }
    const response = await fetch(url);
    const arrayBuffer = await response.arrayBuffer(); // Use arrayBuffer instead of buffer
    const buffer = Buffer.from(arrayBuffer);
    const img = await loadImage(buffer);

    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 128, 128);

    const imageTensor = tf.browser.fromPixels(canvas);
    return imageTensor.toFloat().div(tf.scalar(255)).expandDims();
}

async function calculateImageSimilarity(url1, url2) {
    const img1 = await loadImageFromUrl(url1);
    const img2 = await loadImageFromUrl(url2);

    const mse = tf.losses.meanSquaredError(img1, img2).dataSync()[0];
    const similarityPercentage = (1 - mse) * 100;

    return similarityPercentage;
}

export { calculateImageSimilarity };
