const { calcPrice, PRICING } = require('../../frontend/pricing');

describe('calcPrice — input validation', () => {
  it('returns null for zero volume', () => {
    expect(calcPrice(0, false, 'pla', 'standard')).toBeNull();
  });

  it('returns null for negative volume', () => {
    expect(calcPrice(-5, false, 'pla', 'standard')).toBeNull();
  });

  it('returns null for unknown filament', () => {
    expect(calcPrice(10, false, 'unobtanium', 'standard')).toBeNull();
  });

  it('returns null for unknown preset', () => {
    expect(calcPrice(10, false, 'pla', 'ultra')).toBeNull();
  });
});

describe('calcPrice — return shape', () => {
  it('returns priceCents, priceUsd, weightG, printTimeH', () => {
    var result = calcPrice(10, false, 'pla', 'standard');
    expect(result).toMatchObject({
      priceCents:  expect.any(Number),
      priceUsd:    expect.any(String),
      weightG:     expect.any(Number),
      printTimeH:  expect.any(Number),
    });
    expect(Number(result.priceUsd)).toBeCloseTo(result.priceCents / 100, 2);
  });
});

describe('calcPrice — minimum order', () => {
  it('applies the minimum order when the computed price is below it', () => {
    // Very small volume will produce a sub-minimum price
    var result = calcPrice(0.001, false, 'pla', 'draft');
    expect(result.priceCents).toBe(Math.round(PRICING.minimumOrderUsd * 100));
  });
});

describe('calcPrice — supports multiplier', () => {
  it('increases print time (and therefore price) when supports are likely', () => {
    var without = calcPrice(20, false, 'pla', 'standard');
    var with_   = calcPrice(20, true,  'pla', 'standard');
    expect(with_.printTimeH).toBeGreaterThan(without.printTimeH);
    expect(with_.priceCents).toBeGreaterThanOrEqual(without.priceCents);
  });

  it('applies the configured support multiplier exactly to the raw print time', () => {
    // volume=20, standard (infill 0.20) → filamentVol=4 cm³
    // rawTime = 4 / (8 * 3.6) = 0.13888...
    // with supports: 0.13888... * 1.15 = 0.15972... → rounded → 0.16
    var result = calcPrice(20, true, 'pla', 'standard');
    expect(result.printTimeH).toBe(0.16);
  });
});

describe('calcPrice — filament differences', () => {
  it('TPU costs more per gram than PLA at a volume above the minimum', () => {
    // Use 500 cm³ so labor doesn't flatten both to the minimum order
    var pla = calcPrice(500, false, 'pla', 'standard');
    var tpu = calcPrice(500, false, 'tpu', 'standard');
    expect(tpu.priceCents).toBeGreaterThan(pla.priceCents);
  });

  it('higher infill preset produces greater weight', () => {
    var draft  = calcPrice(20, false, 'pla', 'draft');
    var strong = calcPrice(20, false, 'pla', 'strong');
    expect(strong.weightG).toBeGreaterThan(draft.weightG);
  });
});

describe('calcPrice — formula parity with server', () => {
  it('matches the server-side derivePrice result for a known input', () => {
    // PLA, standard, 12.5 cm³, no supports
    // filamentVol = 12.5 * 0.20 = 2.5 cm³
    // weightG     = 2.5 * 1.24  = 3.1 g
    // filamentCost = 3.1 * (20/1000) = 0.062
    // printTimeH  = 2.5 / (8 * 3.6) = 0.08680...
    // machineCost = 0.0868 * 2.50 = 0.2170
    // laborCost   = 0.25 * 25    = 6.25
    // overheadCost = 0.0868 * 1  = 0.0868
    // subtotal    = 0.062 + 0.217 + 6.25 + 0.0868 = 6.6158
    // price       = 6.6158 * 1.30 = 8.6005
    // final       = max(8.6005, 10.00) = 10.00  (minimum applies)
    var result = calcPrice(12.5, false, 'pla', 'standard');
    expect(result.priceCents).toBe(1000);
    expect(result.priceUsd).toBe('10.00');
  });
});
