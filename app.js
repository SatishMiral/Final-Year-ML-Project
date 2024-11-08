import dotenv from 'dotenv';
dotenv.config();

import { calculateImageSimilarity } from './matching.js';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

app.get('/start-puppeteer', async (req, res) => {
    try {
        const flipkartUrl = req.query.url;
        
        if (!flipkartUrl) {
            return res.status(400).send('Flipkart URL is required.');
        }

        const browser = await puppeteer.launch();
        const page = await browser.newPage();
        await page.goto(flipkartUrl);

        await page.waitForSelector('._6EBuvT');
        
        const extractedText = await page.evaluate(() => {
            const element = document.querySelector('._6EBuvT');
            return element ? element.innerText : null;
        });
        const extractedPrice = await page.evaluate(() => {
            const price = document.querySelector('.Nx9bqj.CxhGGd');
            return price ? price.innerText : null;
        });
        const extractedUrl = await page.evaluate(() => {
            const divElement = document.querySelector('.DByuf4.IZexXJ.jLEJ7H');
            return divElement ? divElement.getAttribute('src') : null;
        });

        const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
        await page.goto(amazonUrl);

        const results = await page.evaluate(() => {
            const items = [];
            const priceElements = document.querySelectorAll('.a-price-whole');
            const ratingElements = document.querySelectorAll('.a-icon-alt');
            const linkElements = document.querySelectorAll('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal');
            const imgUrlElements = document.querySelectorAll('.s-image');

            const price = priceElements[0]?.innerText || "No price available";
            const rating = ratingElements[0]?.innerText?.slice(0, 3) || "No rating available";
            const link = linkElements[0]?.href || "No Link Available";
            const imgUrl = imgUrlElements[0]?.getAttribute('src') || null;

            items.push({ price, rating, link, imgUrl });
            return items;
        });

        await browser.close();

        let firstResultSimilarityPercentage = null;
        if (results.length > 0 && extractedUrl && results[0].imgUrl) {
            try {
                firstResultSimilarityPercentage = await calculateImageSimilarity(extractedUrl, results[0].imgUrl);
                console.log(`Matching Percentage for the first Amazon result: ${firstResultSimilarityPercentage.toFixed(2)}%`);
            } catch (error) {
                console.error("Error calculating image similarity:", error);
            }
        } else {
            console.log("Skipping similarity calculation due to missing image URL");
        }

        const responseData = {
            results: results.map((result, index) => ({
                ...result,
                extractedPrice,
                extractedUrl,
                percentage: index === 0 ? firstResultSimilarityPercentage : null 
            }))
        };

        console.log("Final Result:", responseData);
        res.json(responseData);
    } catch (error) {
        console.error("Error running Puppeteer:", error);
        res.status(500).send("Failed to run Puppeteer script.");
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`Server is running on Port:${PORT}`);
});
