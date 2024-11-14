import dotenv from 'dotenv';
dotenv.config();

import { calculateImageSimilarity } from './matching.js';
import puppeteer from 'puppeteer';
import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());

// Launch a single browser instance and reuse it
let browser;
(async () => {
    browser = await puppeteer.launch({ headless: true, args: ['--no-sandbox', '--disable-setuid-sandbox'] });
})();

app.get('/start-puppeteer', async (req, res) => {
    try {
        const flipkartUrl = req.query.url;
        
        if (!flipkartUrl) {
            return res.status(400).send('Flipkart URL is required.');
        }

        const page = await browser.newPage();
        
        // Disable images, CSS, and fonts to speed up loading
        await page.setRequestInterception(true);
        page.on('request', (req) => {
            if (['stylesheet', 'font'].includes(req.resourceType())) {
                req.abort();
            } else {
                req.continue();
            }
        });

        await page.goto(flipkartUrl, { waitUntil: 'domcontentloaded' });

        // Wait and extract text and price
        await page.waitForSelector('._6EBuvT');
        const extractedText = await page.$eval('._6EBuvT', el => el.innerText);
        const extractedPrice = await page.$eval('.Nx9bqj.CxhGGd', el => el.innerText || null);
        const extractedUrl = await page.$eval('.DByuf4.IZexXJ.jLEJ7H', el => el.getAttribute('src') || null);

        const amazonUrl = `https://www.amazon.in/s?k=${encodeURIComponent(extractedText)}`;
        await page.goto(amazonUrl, { waitUntil: 'domcontentloaded' });

        const results = await page.evaluate(() => {
            const items = [];
            const priceElement = document.querySelector('.a-price-whole');
            const ratingElement = document.querySelector('.a-icon-alt');
            const linkElement = document.querySelector('.a-link-normal.s-underline-text.s-underline-link-text.s-link-style.a-text-normal');
            const imgUrlElement = document.querySelector('.s-image');

            const price = priceElement?.innerText || "No price available";
            const rating = ratingElement?.innerText?.slice(0, 3) || "No rating available";
            const link = linkElement?.href || "No Link Available";
            const imgUrl = imgUrlElement?.getAttribute('src') || null;

            items.push({ price, rating, link, imgUrl });
            return items;
        });

        await page.close();

        let firstResultSimilarityPercentage = null;
        if (results.length > 0 && extractedUrl && results[0].imgUrl) {
            try {
                firstResultSimilarityPercentage = await calculateImageSimilarity(extractedUrl, results[0].imgUrl);
                //console.log(`Matching Percentage for the first Amazon result: ${firstResultSimilarityPercentage.toFixed(2)}%`);
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

        //console.log("Final Result:", responseData);
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
