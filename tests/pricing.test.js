const { derivePrice } = require('../api/lib/pricing');

const CONFIG = {
  filaments: [
    { id: 'pla',  name: 'PLA',          density_g_per_cm3: 1.24, cost_per_kg: 20.00 },
    { id: 'petg', name: 'PETG',         density_g_per_cm3: 1.27, cost_per_kg: 25.00 },
    { id: 'abs',  name: 'ABS',          density_g_per_cm3: 1.04, cost_per_kg: 22.00 },
    { id: 'tpu',  name: 'TPU (Flexible)', density_g_per_cm3: 1.21, cost_per_kg: 35.00 },
  ],
  strength_presets: {
    draft:    { label: 'Draft',    infill_pct: 10, layer_height_mm: 0.30 },
    standard: { label: 'Standard', infill_pct: 20, layer_height_mm: 0.20 },
    strong:   { label: 'Strong',   infill_pct: 40, layer_height_mm: 0.15 },
  },
  machine_rate_per_hour:   2.50,
  labor_rate_per_hour:    25.00,
  overhead_rate_per_hour:  1.00,
  support_multiplier:      1.15,
  profit_margin_pct:       30,
  minimum_order_usd:       10.00,
  max_stl_size_mb:         50,
  print_speed_mm3_per_second: 8.0,
};

describe('derivePrice', () => {
  describe('standard calculation', () => {
    it('returns correct price_cents for PLA standard 100cm³ no supports', () => {
      const result = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'standard', CONFIG);
      expect(result.price_cents).toBe(1193);
      expect(result.weight_g).toBe(24.8);
      expect(result.print_time_hours).toBe(0.69);
      expect(result.breakdown.minimum_applied).toBe(false);
    });

    it('returns a breakdown with all cost components', () => {
      const result = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'standard', CONFIG);
      expect(result.breakdown).toMatchObject({
        filament_cost: expect.any(Number),
        machine_cost:  expect.any(Number),
        labor_cost:    expect.any(Number),
        overhead_cost: expect.any(Number),
        subtotal:      expect.any(Number),
        margin_pct:    30,
      });
    });
  });

  describe('minimum price floor', () => {
    it('applies minimum_order_usd when calculated price is below floor', () => {
      const result = derivePrice({ volume_cm3: 5, supports_likely: false }, 'pla', 'standard', CONFIG);
      expect(result.price_cents).toBe(1000);
      expect(result.breakdown.minimum_applied).toBe(true);
    });

    it('does not apply minimum when price exceeds floor', () => {
      const result = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'standard', CONFIG);
      expect(result.breakdown.minimum_applied).toBe(false);
    });
  });

  describe('support multiplier', () => {
    it('increases price when supports_likely is true', () => {
      const without = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'standard', CONFIG);
      const with_sup = derivePrice({ volume_cm3: 100, supports_likely: true },  'pla', 'standard', CONFIG);
      expect(with_sup.price_cents).toBeGreaterThan(without.price_cents);
      expect(with_sup.price_cents).toBe(1240);
    });

    it('does not change filament weight when supports applied (only time-based costs change)', () => {
      const without = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'standard', CONFIG);
      const with_sup = derivePrice({ volume_cm3: 100, supports_likely: true },  'pla', 'standard', CONFIG);
      expect(with_sup.weight_g).toBe(without.weight_g);
      expect(with_sup.breakdown.filament_cost).toBe(without.breakdown.filament_cost);
    });
  });

  describe('all filament types', () => {
    const filaments = ['pla', 'petg', 'abs', 'tpu'];

    filaments.forEach(id => {
      it(`produces a valid result for ${id}`, () => {
        const result = derivePrice({ volume_cm3: 100, supports_likely: false }, id, 'standard', CONFIG);
        expect(result.price_cents).toBeGreaterThanOrEqual(1000);
        expect(result.weight_g).toBeGreaterThan(0);
      });
    });

    it('TPU costs more than PLA for same volume (higher filament cost)', () => {
      const pla = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla',  'standard', CONFIG);
      const tpu = derivePrice({ volume_cm3: 100, supports_likely: false }, 'tpu',  'standard', CONFIG);
      expect(tpu.breakdown.filament_cost).toBeGreaterThan(pla.breakdown.filament_cost);
    });
  });

  describe('all strength presets', () => {
    it('strong uses more filament than draft', () => {
      const draft  = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'draft',    CONFIG);
      const strong = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'strong',   CONFIG);
      expect(strong.weight_g).toBeGreaterThan(draft.weight_g);
    });

    it('standard is between draft and strong', () => {
      const draft    = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'draft',    CONFIG);
      const standard = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'standard', CONFIG);
      const strong   = derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'strong',   CONFIG);
      expect(standard.weight_g).toBeGreaterThan(draft.weight_g);
      expect(standard.weight_g).toBeLessThan(strong.weight_g);
    });
  });

  describe('input validation', () => {
    it('throws on zero volume', () => {
      expect(() => derivePrice({ volume_cm3: 0, supports_likely: false }, 'pla', 'standard', CONFIG))
        .toThrow('Invalid volume');
    });

    it('throws on negative volume', () => {
      expect(() => derivePrice({ volume_cm3: -5, supports_likely: false }, 'pla', 'standard', CONFIG))
        .toThrow('Invalid volume');
    });

    it('throws on unknown filament ID', () => {
      expect(() => derivePrice({ volume_cm3: 100, supports_likely: false }, 'nylon', 'standard', CONFIG))
        .toThrow('Unknown filament');
    });

    it('throws on unknown strength preset', () => {
      expect(() => derivePrice({ volume_cm3: 100, supports_likely: false }, 'pla', 'ultra', CONFIG))
        .toThrow('Unknown strength preset');
    });
  });
});
