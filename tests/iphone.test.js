const { test } = require('@playwright/test');
const HomePage = require('../pages/homePage');
const ProductPage = require('../pages/productPage');
const Logger = require('../utils/logger');

test.setTimeout(120000);

test('Test Case 1: Search iPhone and add to cart', async ({ page }) => {
    try {
        const home = new HomePage(page);

        await home.navigate();
        await home.searchProduct('iPhone 16 Plus');

        const productPage = await home.openFirstAvailableProduct();
        const product = new ProductPage(productPage);

        const price = await product.getProductPrice();
        Logger.log(`iPhone Price: ${price}`);

        await product.addToCart();
    } catch (error) {
        if (error.name === 'AmazonBlockedError') {
            test.skip(true, error.message);
        }

        throw error;
    }
});
