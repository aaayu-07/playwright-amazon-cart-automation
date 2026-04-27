const ProductPage = require('./productPage');

class HomePage {
    constructor(page) {
        this.page = page;
        this.searchBox = page.locator('#twotabsearchtextbox');
        this.productTitle = page.locator('#productTitle');
        this.captchaInput = page.locator('#captchacharacters, input[name="field-keywords"][placeholder*="characters"]');
        this.continueShoppingButton = page.getByRole('button', { name: /continue shopping/i })
            .or(page.getByRole('link', { name: /continue shopping/i }));
        this.deliveryLocation = page.locator('#nav-global-location-slot, #nav-global-location-popover-link, #glow-ingress-line1, #glow-ingress-line2');
        this.deliveryLocationTrigger = page.locator('#nav-global-location-popover-link, #glow-ingress-block').first();
        this.zipInput = page.locator('#GLUXZipUpdateInput');
        this.applyZipButton = page.locator('#GLUXZipUpdate, input[aria-labelledby="GLUXZipUpdate-announce"]');
        this.doneLocationButton = page.locator('#GLUXConfirmClose, button[name="glowDoneButton"]');
        this.continueLocationButton = page.getByRole('button', { name: /^continue$/i });
        this.searchResultCards = page.locator('[data-component-type="s-search-result"]');
        this.nextResultsPage = page.locator('a.s-pagination-next:not(.s-pagination-disabled)');
        this.searchResultLinks = page.locator([
            '[data-component-type="s-search-result"] h2 a[href*="/dp/"]',
            '[data-component-type="s-search-result"] a.a-link-normal[href*="/dp/"]',
            'a.a-link-normal[href*="/dp/"] h2',
        ].join(', '));
    }

    async navigate() {
        await this.page.goto('https://www.amazon.com', { waitUntil: 'domcontentloaded' });
        await this.page.waitForLoadState('domcontentloaded');
        await this.acceptCookiesIfPresent();
        await this.dismissDeliveryDialogIfPresent();
        await this.throwIfBlocked('opening Amazon home page');
        await this.waitForVisibleState(['home', 'product', 'searchResults', 'blocked'], 15000);
        await this.setDeliveryLocation('10001');
        await this.throwIfBlocked('opening Amazon home page');
    }

    async searchProduct(product) {
        await this.throwIfBlocked(`searching for "${product}"`);
        await this.searchBox.waitFor({ state: 'visible', timeout: 15000 });
        await this.searchBox.fill(product);

        await Promise.all([
            this.page.waitForLoadState('domcontentloaded').catch(() => {}),
            this.searchBox.press('Enter'),
        ]);

        await this.waitForVisibleState(['product', 'searchResults', 'blocked'], 20000);
        await this.dismissDeliveryDialogIfPresent();
        await this.throwIfBlocked(`searching for "${product}"`);
    }

    async openFirstProduct() {
        await this.throwIfBlocked('opening the first product');

        if (await this.isProductPage()) {
            return this.page;
        }

        if (!(await this.isSearchResultsPage())) {
            throw new Error(`Expected search results or product page, but reached: ${await this.describeCurrentPage()}`);
        }

        const productLink = await this.getFirstVisibleProductLink();
        if (!productLink) {
            throw new Error(`Search results loaded, but no product link was found. Current page: ${await this.describeCurrentPage()}`);
        }

        await Promise.all([
            this.page.waitForLoadState('domcontentloaded').catch(() => {}),
            productLink.click(),
        ]);

        await this.waitForVisibleState(['product', 'blocked'], 20000);
        await this.dismissDeliveryDialogIfPresent();
        await this.throwIfBlocked('opening the selected product');

        if (!(await this.isProductPage())) {
            throw new Error(`Product link clicked, but product page did not load. Current page: ${await this.describeCurrentPage()}`);
        }

        return this.page;
    }

    async openFirstAvailableProduct({ maxProducts = 12, maxPages = 3 } = {}) {
        await this.throwIfBlocked('opening the first available product');

        if (await this.isProductPage()) {
            const product = new ProductPage(this.page);
            if (await product.isAddToCartAvailable()) {
                return this.page;
            }

            await this.goBackToSearchResults();
        }

        if (!(await this.isSearchResultsPage())) {
            throw new Error(`Expected search results before product iteration, but reached: ${await this.describeCurrentPage()}`);
        }

        let checkedProducts = 0;

        for (let pageNumber = 1; pageNumber <= maxPages; pageNumber++) {
            const candidateCount = Math.min(await this.getProductCandidateCount(), maxProducts);

            for (let index = 0; index < candidateCount; index++) {
                checkedProducts++;
                await this.throwIfBlocked(`checking product result ${checkedProducts}`);

                const productLink = await this.getVisibleProductLinkAt(index);
                if (!productLink) {
                    continue;
                }

                await Promise.all([
                    this.page.waitForLoadState('domcontentloaded').catch(() => {}),
                    productLink.click(),
                ]);

                await this.waitForVisibleState(['product', 'blocked'], 20000);
                await this.dismissDeliveryDialogIfPresent();
                await this.throwIfBlocked(`checking product result ${checkedProducts}`);

                if (!(await this.isProductPage())) {
                    await this.goBackToSearchResults();
                    continue;
                }

                const product = new ProductPage(this.page);
                if (await product.isAddToCartAvailable()) {
                    return this.page;
                }

                await this.goBackToSearchResults();
            }

            if (pageNumber < maxPages && await this.hasNextResultsPage()) {
                await this.openNextResultsPage();
                continue;
            }

            break;
        }

        throw new Error(`No product with an enabled Add to Cart button was found after checking ${checkedProducts} result(s) across up to ${maxPages} search page(s).`);
    }

    async acceptCookiesIfPresent() {
        const acceptButton = this.page.locator('#sp-cc-accept, input[name="accept"]');
        if (await acceptButton.first().isVisible().catch(() => false)) {
            await acceptButton.first().click();
        }
    }

    async dismissDeliveryDialogIfPresent() {
        const dismissButton = this.page.getByRole('button', { name: /^dismiss$/i });
        if (await dismissButton.first().isVisible().catch(() => false)) {
            await dismissButton.first().click().catch(() => {});
        }
    }

    async setDeliveryLocation(zipCode = '10001') {
        await this.throwIfBlocked('setting delivery location');

        if (await this.isZipAlreadySet(zipCode)) {
            return;
        }

        await this.deliveryLocationTrigger.waitFor({ state: 'visible', timeout: 15000 });
        await this.deliveryLocationTrigger.click();

        await this.waitForLocationPopup();
        await this.throwIfBlocked('setting delivery location');
        await this.zipInput.fill(zipCode);

        await Promise.all([
            this.page.waitForLoadState('domcontentloaded').catch(() => {}),
            this.applyZipButton.first().click(),
        ]);

        await this.closeLocationPopupIfPresent();
        await this.waitForDeliveryLocation(zipCode);
        await this.dismissDeliveryDialogIfPresent();
        await this.throwIfBlocked('setting delivery location');
    }

    async isZipAlreadySet(zipCode = '10001') {
        const deadline = Date.now() + 5000;

        while (Date.now() < deadline) {
            const locationText = await this.getDeliveryLocationText();
            if (locationText.includes(zipCode)) {
                return true;
            }

            if (locationText && !/deliver to|update location/i.test(locationText)) {
                return false;
            }

            if (await this.getBlockingReason()) {
                return false;
            }

            await this.page.waitForTimeout(250);
        }

        return false;
    }

    async getDeliveryLocationText() {
        const texts = await this.deliveryLocation.evaluateAll((nodes) =>
            nodes.map((node) => node.textContent || '').filter(Boolean)
        ).catch(() => []);

        return texts.join(' ').replace(/\s+/g, ' ').trim();
    }

    async waitForLocationPopup() {
        const deadline = Date.now() + 15000;

        while (Date.now() < deadline) {
            if (await this.zipInput.isVisible().catch(() => false)) {
                return;
            }

            if (await this.getBlockingReason()) {
                return;
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(`Timed out waiting for delivery location popup. Current page: ${await this.describeCurrentPage()}`);
    }

    async closeLocationPopupIfPresent() {
        const deadline = Date.now() + 10000;

        while (Date.now() < deadline) {
            if (await this.continueLocationButton.first().isVisible().catch(() => false)) {
                await this.continueLocationButton.first().click().catch(() => {});
                return;
            }

            if (await this.doneLocationButton.first().isVisible().catch(() => false)) {
                await this.doneLocationButton.first().click().catch(() => {});
                return;
            }

            if (!(await this.zipInput.isVisible().catch(() => false))) {
                return;
            }

            await this.page.waitForTimeout(250);
        }
    }

    async waitForDeliveryLocation(zipCode) {
        const deadline = Date.now() + 20000;

        while (Date.now() < deadline) {
            const locationText = await this.getDeliveryLocationText();
            if (locationText.includes(zipCode)) {
                return;
            }

            if (await this.continueLocationButton.first().isVisible().catch(() => false)) {
                await this.continueLocationButton.first().click().catch(() => {});
            }

            if (await this.getBlockingReason()) {
                return;
            }

            await this.page.waitForTimeout(500);
        }

        throw new Error(`Timed out waiting for delivery location to update to ${zipCode}. Current location: "${await this.getDeliveryLocationText()}".`);
    }

    async isProductPage() {
        if (/\/(dp|gp\/product)\//.test(this.page.url())) {
            return true;
        }

        return this.productTitle.first().isVisible().catch(() => false);
    }

    async isSearchResultsPage() {
        return this.page.locator('[data-component-type="s-search-result"]').first().isVisible().catch(() => false);
    }

    async getBlockingReason() {
        if (await this.captchaInput.first().isVisible().catch(() => false)) {
            return 'Amazon CAPTCHA page detected';
        }

        if (await this.continueShoppingButton.first().isVisible().catch(() => false)) {
            return 'Amazon Continue Shopping interstitial detected';
        }

        return null;
    }

    async throwIfBlocked(action) {
        const reason = await this.getBlockingReason();
        if (reason) {
            const error = new Error(`${reason} while ${action}. Test stopped intentionally; solve the challenge manually or retry later.`);
            error.name = 'AmazonBlockedError';
            throw error;
        }
    }

    async getFirstVisibleProductLink() {
        const cardCount = Math.min(await this.searchResultCards.count(), 20);

        for (let i = 0; i < cardCount; i++) {
            const card = this.searchResultCards.nth(i);
            const price = card.locator('.a-price .a-offscreen').first();
            const link = card.locator('h2 a[href*="/dp/"], a.a-link-normal[href*="/dp/"]').first();

            if (
                await card.isVisible().catch(() => false) &&
                await price.isVisible().catch(() => false) &&
                await link.isVisible().catch(() => false)
            ) {
                return link;
            }
        }

        const count = Math.min(await this.searchResultLinks.count(), 20);

        for (let i = 0; i < count; i++) {
            const candidate = this.searchResultLinks.nth(i);
            const locator = this.page.locator('a[href*="/dp/"]').filter({ has: candidate }).first();

            if (await locator.isVisible().catch(() => false)) {
                return locator;
            }

            if (await candidate.isVisible().catch(() => false)) {
                return candidate;
            }
        }

        return null;
    }

    async getProductCandidateCount() {
        const pricedCards = await this.searchResultCards.filter({
            has: this.page.locator('.a-price .a-offscreen'),
        }).count().catch(() => 0);

        if (pricedCards > 0) {
            return pricedCards;
        }

        return await this.searchResultLinks.count();
    }

    async getVisibleProductLinkAt(index) {
        const pricedCards = this.searchResultCards.filter({
            has: this.page.locator('.a-price .a-offscreen'),
        });
        const pricedCount = await pricedCards.count().catch(() => 0);

        if (index < pricedCount) {
            const link = pricedCards.nth(index).locator('h2 a[href*="/dp/"], a.a-link-normal[href*="/dp/"]').first();
            if (await link.isVisible().catch(() => false)) {
                return link;
            }
        }

        const candidate = this.searchResultLinks.nth(index - pricedCount);
        const locator = this.page.locator('a[href*="/dp/"]').filter({ has: candidate }).first();

        if (await locator.isVisible().catch(() => false)) {
            return locator;
        }

        if (await candidate.isVisible().catch(() => false)) {
            return candidate;
        }

        return null;
    }

    async goBackToSearchResults() {
        await Promise.all([
            this.page.waitForLoadState('domcontentloaded').catch(() => {}),
            this.page.goBack({ waitUntil: 'domcontentloaded' }),
        ]);

        await this.waitForVisibleState(['searchResults', 'blocked'], 20000);
        await this.dismissDeliveryDialogIfPresent();
        await this.throwIfBlocked('returning to search results');
    }

    async hasNextResultsPage() {
        return await this.nextResultsPage.first().isVisible().catch(() => false);
    }

    async openNextResultsPage() {
        await Promise.all([
            this.page.waitForLoadState('domcontentloaded').catch(() => {}),
            this.nextResultsPage.first().click(),
        ]);

        await this.waitForVisibleState(['searchResults', 'blocked'], 20000);
        await this.dismissDeliveryDialogIfPresent();
        await this.throwIfBlocked('opening the next search results page');
    }

    async waitForVisibleState(states, timeout = 15000) {
        const deadline = Date.now() + timeout;

        while (Date.now() < deadline) {
            const currentState = await this.getPageState();
            if (states.includes(currentState)) {
                return currentState;
            }

            await this.page.waitForTimeout(250);
        }

        throw new Error(`Timed out waiting for page state [${states.join(', ')}]. Current page: ${await this.describeCurrentPage()}`);
    }

    async getPageState() {
        if (await this.getBlockingReason()) {
            return 'blocked';
        }

        if (await this.isProductPage()) {
            return 'product';
        }

        if (await this.isSearchResultsPage()) {
            return 'searchResults';
        }

        if (await this.searchBox.isVisible().catch(() => false)) {
            return 'home';
        }

        return 'unknown';
    }

    async describeCurrentPage() {
        const title = await this.page.title().catch(() => 'unknown title');
        return `"${title}" at ${this.page.url()}`;
    }
}

module.exports = HomePage;
