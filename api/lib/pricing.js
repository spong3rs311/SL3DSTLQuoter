// Authoritative pricing formula — must stay in sync with frontend/widget.js client copy.
// If you change this formula, update both files.

function derivePrice(quoteDetails, filamentId, preset, config) {
  const { volume_cm3, supports_likely } = quoteDetails;

  if (!volume_cm3 || volume_cm3 <= 0) {
    throw new Error('Invalid volume: must be greater than 0');
  }

  const filament = config.filaments.find(f => f.id === filamentId);
  if (!filament) throw new Error(`Unknown filament: ${filamentId}`);

  const strength = config.strength_presets[preset];
  if (!strength) throw new Error(`Unknown strength preset: ${preset}`);

  const filament_volume_cm3 = volume_cm3 * (strength.infill_pct / 100);
  const filament_weight_g = filament_volume_cm3 * filament.density_g_per_cm3;
  const filament_cost = filament_weight_g * (filament.cost_per_kg / 1000);

  // cm3 → mm3 = ×1000; mm3/s → hours = ÷3600; combined: ÷(speed × 3.6)
  let print_time_hours = filament_volume_cm3 / (config.print_speed_mm3_per_second * 3.6);
  if (supports_likely) {
    print_time_hours *= config.support_multiplier;
  }

  const machine_cost = print_time_hours * config.machine_rate_per_hour;
  const labor_cost = 0.25 * config.labor_rate_per_hour; // fixed 15-min setup
  const overhead_cost = print_time_hours * config.overhead_rate_per_hour;

  const subtotal = filament_cost + machine_cost + labor_cost + overhead_cost;
  const price = subtotal * (1 + config.profit_margin_pct / 100);
  const final_price = Math.max(price, config.minimum_order_usd);

  return {
    price_usd: Math.round(final_price * 100) / 100,
    price_cents: Math.round(final_price * 100),
    weight_g: Math.round(filament_weight_g * 10) / 10,
    print_time_hours: Math.round(print_time_hours * 100) / 100,
    breakdown: {
      filament_cost: Math.round(filament_cost * 100) / 100,
      machine_cost: Math.round(machine_cost * 100) / 100,
      labor_cost: Math.round(labor_cost * 100) / 100,
      overhead_cost: Math.round(overhead_cost * 100) / 100,
      subtotal: Math.round(subtotal * 100) / 100,
      margin_pct: config.profit_margin_pct,
      minimum_applied: final_price === config.minimum_order_usd,
    },
  };
}

module.exports = { derivePrice };
