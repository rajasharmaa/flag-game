import { countries } from './src/data/countries.js';

console.log('Total countries:', countries.length);
console.log('First 5 countries:');
countries.slice(0, 5).forEach(country => {
  console.log(`${country.emoji} ${country.name} (${country.code})`);
});