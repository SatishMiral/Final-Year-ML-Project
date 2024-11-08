import fetch from 'node-fetch';
import { createCanvas, loadImage } from 'canvas';
import * as tf from '@tensorflow/tfjs';

// Function to load and preprocess an image from a URL
async function loadImageFromUrl(url) {
    if (!url || !url.startsWith('http')) {
        throw new Error('Invalid or missing URL');
    }
    const response = await fetch(url);
    const buffer = await response.buffer();
    const img = await loadImage(buffer);

    // Create a canvas to resize the image
    const canvas = createCanvas(128, 128);
    const ctx = canvas.getContext('2d');
    ctx.drawImage(img, 0, 0, 128, 128);

    // Convert the canvas image to a tensor
    const imageTensor = tf.browser.fromPixels(canvas);
    return imageTensor.toFloat().div(tf.scalar(255)).expandDims(); // Normalize
}

// Function to calculate similarity percentage between two image tensors
async function calculateImageSimilarity(url1, url2) {
    const img1 = await loadImageFromUrl(url1);
    const img2 = await loadImageFromUrl(url2);

    // Calculate the mean squared error between the two images
    const mse = tf.losses.meanSquaredError(img1, img2).dataSync()[0];
    
    // Inverse MSE to get a similarity score (lower MSE means more similarity)
    const similarityPercentage = (1 - mse) * 100;

    return similarityPercentage; // Return the matching percentage
}

export { calculateImageSimilarity }; 