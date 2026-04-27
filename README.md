# Amazon Automation Testing - Playwright

## Overview
This project automates the assignment scenarios for Amazon.com using Playwright with JavaScript.

## Test Cases
- Search for `iPhone 16 Plus`, open an available product, print the price, and add it to cart.
- Search for `Samsung Galaxy`, open an available product, print the price, and add it to cart.
- Run both test cases in parallel.

## Tech Stack
- JavaScript
- Playwright Test
- Page Object Model

## Project Structure
```text
pages/
  homePage.js
  productPage.js
tests/
  iphone.test.js
  galaxy.test.js
utils/
  logger.js
playwright.config.js
```

## Key Handling
- Sets Amazon delivery location to US ZIP code `10001` before running test steps.
- Detects CAPTCHA / Continue Shopping pages and stops cleanly.
- Handles search-result and direct-product navigation flows.
- Tries multiple product results until it finds an enabled Add to Cart button.

## Setup
```bash
npm install
npx playwright install chromium
```

## Run Tests
```bash
npm test
```

Run in headed mode:
```bash
npm run test:headed
```

Open the HTML report:
```bash
npm run report
```

## Parallel Execution
Parallel execution is configured in `playwright.config.js`:

```js
fullyParallel: true,
workers: 2
```

## Notes
Amazon may show CAPTCHA or bot-detection pages depending on network/session behavior. This project does not bypass those pages; it detects them and stops cleanly.
