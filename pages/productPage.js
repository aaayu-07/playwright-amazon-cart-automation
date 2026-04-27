class ProductPage {
    constructor(page) {
        this.page = page;
        this.productTitle = page.locator('#productTitle');
        this.price = page.locator([
            '#corePrice_feature_div .a-price .a-offscreen',
            '#corePriceDisplay_desktop_feature_div .a-price .a-offscreen',
            '#corePriceDisplay_mobile_feature_div .a-price .a-offscreen',
            '#apex_desktop .a-price .a-offscreen',
            '#tp_price_block_total_price_ww .a-offscreen',
            '.reinventPricePriceToPayMargin .a-offscreen',
            '.a-price .a-offscreen',
        ].join(', '));
        this.addToCartBtn = page.locator('#add-to-cart-button, input[name="submit.add-to-cart"]');
        this.unavailableMessage = page.getByText(/no featured offers available|currently unavailable|cannot be shipped|beyond seller's shipping coverage|choose a different delivery location/i);
    }

    async getProductPrice() {
        await this.waitForProductPage();

        const priceCount = Math.min(await this.price.count(), 10);
        for (let i = 0; i < priceCount; i++) {
            const price = this.price.nth(i);
            if (await price.isVisible().catch(() => false)) {
                const text = await price.textContent();
                if (text && text.trim()) {
                    return text.trim();
                }
            }
        }

        await this.throwIfUnavailable('reading product price');
        throw new Error(`Product page loaded, but no visible price was found. Current page: ${await this.describeCurrentPage()}`);
    }

    async isAddToCartAvailable() {
        await this.waitForProductPage();

        const deadline = Date.now() + 8000;
        const addToCart = this.addToCartBtn.first();

        while (Date.now() < deadline) {
            if (await this.unavailableMessage.first().isVisible().catch(() => false)) {
                return false;
            }

            if (await addToCart.isVisible().catch(() => false)) {
                return await addToCart.isEnabled().catch(() => false);
            }

            await this.page.waitForTimeout(250);
        }

        return false;
    }

    async addToCart() {
        await this.waitForProductPage();
        await this.throwIfUnavailable('adding product to cart');

        const addToCart = this.addToCartBtn.first();
        if (await addToCart.isVisible().catch(() => false) && !(await addToCart.isEnabled().catch(() => false))) {
            const error = new Error(`Amazon product has a disabled Add to Cart button. Current page: ${await this.describeCurrentPage()}`);
            error.name = 'AmazonUnavailableError';
            throw error;
        }

        if (!(await addToCart.isVisible().catch(() => false))) {
            throw new Error(`Product page loaded, but Add to Cart is not available. Current page: ${await this.describeCurrentPage()}`);
        }

        await Promise.all([
            this.page.waitForLoadState('domcontentloaded').catch(() => {}),
            addToCart.click(),
        ]);
    }

    async waitForProductPage() {
        if (!/\/(dp|gp\/product)\//.test(this.page.url())) {
            await this.productTitle.first().waitFor({ state: 'visible', timeout: 15000 });
            return;
        }

        await this.page.waitForLoadState('domcontentloaded').catch(() => {});
        const deadline = Date.now() + 15000;

        while (Date.now() < deadline) {
            if (
                await this.productTitle.first().isVisible().catch(() => false) ||
                await this.price.first().isVisible().catch(() => false) ||
                await this.addToCartBtn.first().isVisible().catch(() => false) ||
                await this.unavailableMessage.first().isVisible().catch(() => false)
            ) {
                return;
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(`Timed out waiting for product content. Current page: ${await this.describeCurrentPage()}`);
    }

    async throwIfUnavailable(action) {
        if (await this.unavailableMessage.first().isVisible().catch(() => false)) {
            const error = new Error(`Amazon product is not purchasable while ${action}. Current page: ${await this.describeCurrentPage()}`);
            error.name = 'AmazonUnavailableError';
            throw error;
        }
    }

    async describeCurrentPage() {
        const title = await this.page.title().catch(() => 'unknown title');
        return `"${title}" at ${this.page.url()}`;
    }
}

module.exports = ProductPage;
