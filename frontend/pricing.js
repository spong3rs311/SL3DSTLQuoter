// Mirrors config.json — server always re-derives the authoritative price at checkout
var PRICING = {
  filaments: {
    pla:  { density: 1.24, costPerKg: 20.00 },
    petg: { density: 1.27, costPerKg: 25.00 },
    abs:  { density: 1.04, costPerKg: 22.00 },
    tpu:  { density: 1.21, costPerKg: 35.00 },
  },
  presets: {
    draft:    { infill: 0.10 },
    standard: { infill: 0.20 },
    strong:   { infill: 0.40 },
  },
  machineRatePerHour:   2.50,
  laborRatePerHour:    25.00,
  overheadRatePerHour:  1.00,
  supportMultiplier:    1.15,
  profitMarginPct:     30,
  minimumOrderUsd:     10.00,
  printSpeedMm3PerSec:  8.0,
};

function calcPrice(volumeCm3, supportsLikely, filamentId, preset) {
  var f = PRICING.filaments[filamentId];
  var p = PRICING.presets[preset];
  if (!f || !p || !volumeCm3 || volumeCm3 <= 0) return null;

  var filamentVol  = volumeCm3 * p.infill;
  var weightG      = filamentVol * f.density;
  var filamentCost = weightG * (f.costPerKg / 1000);
  var printTimeH   = filamentVol / (PRICING.printSpeedMm3PerSec * 3.6);
  if (supportsLikely) printTimeH *= PRICING.supportMultiplier;

  var machineCost  = printTimeH * PRICING.machineRatePerHour;
  var laborCost    = 0.25 * PRICING.laborRatePerHour;
  var overheadCost = printTimeH * PRICING.overheadRatePerHour;
  var subtotal     = filamentCost + machineCost + laborCost + overheadCost;
  var price        = subtotal * (1 + PRICING.profitMarginPct / 100);
  var final        = Math.max(price, PRICING.minimumOrderUsd);

  return {
    priceCents:  Math.round(final * 100),
    priceUsd:    (Math.round(final * 100) / 100).toFixed(2),
    weightG:     Math.round(weightG * 10) / 10,
    printTimeH:  Math.round(printTimeH * 100) / 100,
  };
}

module.exports = { calcPrice, PRICING };
