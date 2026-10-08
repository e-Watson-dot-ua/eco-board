// The four status cards: battery (with its gauge), power in, power out, temperature.

// Below this level the battery gauge shows a warning.
const LOW_BATTERY_PERCENT = 20;

const el = {
  battery: document.getElementById('battery'),
  batteryLow: document.getElementById('battery-low'),
  batteryGauge: document.getElementById('battery-gauge'),
  batteryFill: document.getElementById('battery-fill'),
  powerIn: document.getElementById('power-in'),
  powerOut: document.getElementById('power-out'),
  temperature: document.getElementById('temperature'),
};

export function showCards(reading) {
  el.battery.textContent = reading.batteryLevel ?? '–';
  showBatteryGauge(reading.batteryLevel);
  el.powerIn.textContent = reading.powerIn ?? '–';
  el.powerOut.textContent = reading.powerOut ?? '–';
  el.temperature.textContent = reading.temperature ?? '–';
}

function showBatteryGauge(level) {
  const percent = level ?? 0;
  el.batteryFill.style.width = `${percent}%`;
  el.batteryGauge.setAttribute('aria-valuenow', String(percent));

  // Low battery: warning color plus a "Low" label, so it is never color alone.
  const low = level != null && level < LOW_BATTERY_PERCENT;
  el.batteryGauge.classList.toggle('low', low);
  el.batteryLow.hidden = !low;
  el.batteryLow.title = `Battery is below ${LOW_BATTERY_PERCENT} %`;
}
