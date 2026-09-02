import { fetchRetailerStock } from './server/stock.js';

const start = Date.now();
try {
  const cars = await fetchRetailerStock('bmw');
  console.log(`OK: ${cars.length} cars in ${((Date.now() - start) / 1000).toFixed(1)}s`);
} catch (err) {
  console.log(`FAILED after ${((Date.now() - start) / 1000).toFixed(1)}s`);
  console.log('message:', err.message);
  console.log('cause:', err.cause);
  console.log('cause.stack:', err.cause?.stack);
}
