// Starts the dashboard. Each part of the page lives in its own module in this folder:
//   api.js      requests to the server, with a timeout
//   config.js   settings from /api/config (poll interval, device serial number)
//   format.js   texts for ages and intervals
//   header.js   connection pill, status line, charging badge, footer
//   cards.js    the four status cards and the battery gauge
//   charts.js   range buttons and the history charts
//   refresh.js  Refresh button and the automatic refresh
import { initCharts } from './charts.js';
import { loadConfig } from './config.js';
import { showFooter } from './header.js';
import { initRefresh, refreshAll } from './refresh.js';

initCharts();
initRefresh();
await loadConfig();
showFooter();
refreshAll();
