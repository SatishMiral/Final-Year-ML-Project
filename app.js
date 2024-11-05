import dotenv from 'dotenv';
dotenv.config();

import { calculateImageSimilarity } from './matching.js';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';

const app = express();

app.use(cors());  // Enable CORS for all requests

// Add a route to accept Flipkart URL as a query parameter
app.get('/start-puppeteer', async (req, res) => {
    try {
        console.log("FlipKart URL: " + req.query.url);
        const flipkartUrl = req.query.url;  // Get the Flipkart URL from the query parameter
        
        if (!flipkartUrl) {
            return res.status(400).send('Flipkart URL is required.');
        }

        const browser = await puppeteer.launch();
        const page = await browser.newPage();

        // Navigate to the Flipkart page using the dynamic URL
        await page.goto(flipkartUrl);

        // Wait for the element with the class _6EBuvT to be present
        await page.waitForSelector('._6EBuvT');

        // Extract the product name or relevant text from Flipkart
        const extractedText = await page.evaluate(() => {
            const element = document.querySelector('._6EBuvT');
            return element ? element.innerText : 'Element not found';
        });

        // Extract the price from Flipkart
        const extractedPrice = await page.evaluate(() => {
            const price = document.querySelector('.Nx9bqj.CxhGGd');
            return price ? price.innerText : 'Element not found';
        });

        // Extract the imgUrl from Flipkart
        const extractedUrl = await page.evaluate(() => {
            const divElement = document.querySelector('.DByuf4.IZexXJ.jLEJ7H');
            return divElement ? divElement.getAttribute('src') : 'Element not found';
        });

        console.log('Extracted Price from Flipkart:', extractedPrice);
        console.log('Extracted Text from Flipkart:', extractedText);
        console.log('Extracted Url from Flipkart:', extractedUrl);

        // Navigate to Amazon and get search results based on the extracted text
        const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
        await page.goto(amazonUrl);

        // Extract Amazon results
        const results = await page.evaluate(() => {
            const items = [];
            const priceElements = document.querySelectorAll('.a-price-whole');
            const ratingElements = document.querySelectorAll('.a-icon-alt');
            const linkElements = document.querySelectorAll('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal');
            const imgUrlElements = document.querySelectorAll('.s-image'); // Select image URL on Amazon

            const price = priceElements[0]?.innerText || "No price available";
            const rating = ratingElements[0]?.innerText?.slice(0, 3) || "No rating available";
            const link = linkElements[0]?.href || "No Link Available";
            const imgUrl = imgUrlElements[0]?.getAttribute('src') || "No image URL available"; // Extract image URL

            items.push({ price, rating, link, imgUrl });
            
            return items;
        });

        // console.log("Amazon Results:", results);
        await browser.close();

        // Calculate similarity percentage only for the first image URL
        let firstResultSimilarityPercentage = null;
        if (results.length > 0) {
            firstResultSimilarityPercentage = await calculateImageSimilarity(extractedUrl, results[0].imgUrl);
            console.log(`Matching Percentage for the first Amazon result: ${firstResultSimilarityPercentage.toFixed(2)}%`); // Log the matching percentage
        }

        // Include the first result and similarity percentage in the response
        const responseData = {
            results: results.map((result, index) => ({
                ...result,
                extractedPrice,
                extractedUrl,
                percentage: index === 0 ? firstResultSimilarityPercentage : null // Only attach percentage to the first result
            }))
        };

        // Log the final result correctly
        console.log("Final Result:", responseData); // Log the final responseData as a formatted JSON string

        // Send back the extracted data as a response
        res.json(responseData);
    } catch (error) {
        console.error("Error running Puppeteer:", error);
        res.status(500).send("Failed to run Puppeteer script.");
    }
});

const PORT = process.env.PORT;

app.listen(PORT, () => {
    console.log(`Server is running on Port:${PORT}`);
});
