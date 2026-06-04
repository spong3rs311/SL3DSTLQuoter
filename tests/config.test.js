const { loadConfig } = require('../api/lib/config');

describe('loadConfig', () => {
  it('returns a config object with required fields', () => {
    const config = loadConfig();
    expect(Array.isArray(config.filaments)).toBe(true);
    expect(config.filaments.length).toBeGreaterThan(0);
    expect(config.strength_presets).toBeDefined();
    expect(typeof config.minimum_order_usd).toBe('number');
    expect(typeof config.profit_margin_pct).toBe('number');
    expect(typeof config.print_speed_mm3_per_second).toBe('number');
  });

  it('each filament has required fields', () => {
    const config = loadConfig();
    config.filaments.forEach(f => {
      expect(f.id).toBeDefined();
      expect(f.density_g_per_cm3).toBeGreaterThan(0);
      expect(f.cost_per_kg).toBeGreaterThan(0);
    });
  });

  it('each strength preset has infill_pct and layer_height_mm', () => {
    const config = loadConfig();
    Object.values(config.strength_presets).forEach(preset => {
      expect(preset.infill_pct).toBeGreaterThan(0);
      expect(preset.layer_height_mm).toBeGreaterThan(0);
    });
  });
});
