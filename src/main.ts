import { boot } from './app.js';
import { initEngage } from './engage.js';
import { initExtras } from './extras.js';
import { initReviews } from './reviews.js';
import { initWow } from './wow.js';

// Module scripts run after the document is parsed, so the DOM is ready here.
void boot(() => {
  initWow(initEngage());
  initExtras();
  initReviews();
});
