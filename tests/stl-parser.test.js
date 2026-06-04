const { parseSTL } = require('../frontend/stl-parser');

// Builds a binary STL ArrayBuffer from an array of triangle descriptors.
// Each descriptor: { nz, v1, v2, v3 } where nz is the stored face normal Z component.
function buildBinarySTL(triangles) {
  const ab = new ArrayBuffer(84 + triangles.length * 50);
  const view = new DataView(ab);
  view.setUint32(80, triangles.length, true);

  let off = 84;
  for (const { nz, v1, v2, v3 } of triangles) {
    view.setFloat32(off,     0,  true); // nx
    view.setFloat32(off + 4, 0,  true); // ny
    view.setFloat32(off + 8, nz, true); // nz
    [v1, v2, v3].forEach((v, i) =>
      v.forEach((c, j) => view.setFloat32(off + 12 + i * 12 + j * 4, c, true))
    );
    view.setUint16(off + 48, 0, true);
    off += 50;
  }
  return ab;
}

// ASCII STL string → ArrayBuffer
function buildASCIISTL(triangles) {
  let text = 'solid test\n';
  for (const { nz, v1, v2, v3 } of triangles) {
    text += `  facet normal 0 0 ${nz}\n`;
    text += `    outer loop\n`;
    text += `      vertex ${v1.join(' ')}\n`;
    text += `      vertex ${v2.join(' ')}\n`;
    text += `      vertex ${v3.join(' ')}\n`;
    text += `    endloop\n`;
    text += `  endfacet\n`;
  }
  text += 'endsolid test\n';
  return new TextEncoder().encode(text).buffer;
}

// 10×10×10mm cube (12 triangles, outward CCW winding) — volume = 1000mm³ = 1cm³
const CUBE = [
  { nz: -1, v1: [0,0,0],   v2: [0,10,0],   v3: [10,10,0]  }, // bottom T1
  { nz: -1, v1: [0,0,0],   v2: [10,10,0],  v3: [10,0,0]   }, // bottom T2
  { nz:  1, v1: [0,0,10],  v2: [10,0,10],  v3: [10,10,10] }, // top T1
  { nz:  1, v1: [0,0,10],  v2: [10,10,10], v3: [0,10,10]  }, // top T2
  { nz:  0, v1: [0,0,0],   v2: [10,0,0],   v3: [10,0,10]  }, // front T1
  { nz:  0, v1: [0,0,0],   v2: [10,0,10],  v3: [0,0,10]   }, // front T2
  { nz:  0, v1: [0,10,0],  v2: [10,10,10], v3: [10,10,0]  }, // back T1
  { nz:  0, v1: [0,10,0],  v2: [0,10,10],  v3: [10,10,10] }, // back T2
  { nz:  0, v1: [0,0,0],   v2: [0,0,10],   v3: [0,10,10]  }, // left T1
  { nz:  0, v1: [0,0,0],   v2: [0,10,10],  v3: [0,10,0]   }, // left T2
  { nz:  0, v1: [10,0,0],  v2: [10,10,0],  v3: [10,10,10] }, // right T1
  { nz:  0, v1: [10,0,0],  v2: [10,10,10], v3: [10,0,10]  }, // right T2
];

// Flat triangle at z=0 (zero volume → is_valid = false)
const FLAT_TRIANGLE = [
  { nz: -1, v1: [0,0,0], v2: [10,0,0], v3: [0,10,0] },
];

describe('parseSTL — binary format', () => {
  it('calculates volume within 1% of 1cm³ for a 10mm cube', () => {
    const result = parseSTL(buildBinarySTL(CUBE));
    expect(result.is_valid).toBe(true);
    expect(result.volume_cm3).toBeCloseTo(1.0, 2);
  });

  it('returns correct bounding box for the cube', () => {
    const result = parseSTL(buildBinarySTL(CUBE));
    expect(result.bbox.x).toBeCloseTo(10, 1);
    expect(result.bbox.y).toBeCloseTo(10, 1);
    expect(result.bbox.z).toBeCloseTo(10, 1);
  });

  it('is_valid is false for a flat (zero-volume) mesh', () => {
    const result = parseSTL(buildBinarySTL(FLAT_TRIANGLE));
    expect(result.is_valid).toBe(false);
    expect(result.volume_cm3).toBe(0);
  });
});

describe('parseSTL — ASCII format', () => {
  it('parses an ASCII STL and returns the same volume as binary', () => {
    const binaryResult = parseSTL(buildBinarySTL(CUBE));
    const asciiResult  = parseSTL(buildASCIISTL(CUBE));
    expect(asciiResult.is_valid).toBe(true);
    expect(asciiResult.volume_cm3).toBeCloseTo(binaryResult.volume_cm3, 1);
  });

  it('returns correct bounding box from ASCII format', () => {
    const result = parseSTL(buildASCIISTL(CUBE));
    expect(result.bbox.x).toBeCloseTo(10, 1);
    expect(result.bbox.y).toBeCloseTo(10, 1);
    expect(result.bbox.z).toBeCloseTo(10, 1);
  });
});

describe('parseSTL — support heuristic', () => {
  it('supports_likely is true when a face has stored nz < -0.5', () => {
    // Cube has a bottom face with nz = -1
    const result = parseSTL(buildBinarySTL(CUBE));
    expect(result.supports_likely).toBe(true);
  });

  it('supports_likely is false when all faces have nz >= -0.5', () => {
    // Only side and top faces (nz = 0 or 1)
    const noOverhangs = CUBE.filter(t => t.nz >= -0.5);
    const result = parseSTL(buildBinarySTL(noOverhangs));
    expect(result.supports_likely).toBe(false);
  });

  it('supports_likely is true exactly at the nz = -0.5 threshold', () => {
    const atThreshold = [{ nz: -0.51, v1: [0,0,5], v2: [10,0,0], v3: [0,10,0] }];
    const result = parseSTL(buildBinarySTL(atThreshold));
    expect(result.supports_likely).toBe(true);
  });

  it('supports_likely is false just above the threshold (nz = -0.49)', () => {
    const justAbove = [{ nz: -0.49, v1: [0,0,5], v2: [10,0,0], v3: [0,10,0] }];
    const result = parseSTL(buildBinarySTL(justAbove));
    expect(result.supports_likely).toBe(false);
  });
});

describe('parseSTL — error handling', () => {
  it('returns is_valid false for a buffer smaller than 84 bytes', () => {
    const result = parseSTL(new ArrayBuffer(50));
    expect(result.is_valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns is_valid false for null input', () => {
    const result = parseSTL(null);
    expect(result.is_valid).toBe(false);
    expect(result.error).toBeDefined();
  });

  it('returns is_valid false for a binary STL with zero triangles', () => {
    const ab = new ArrayBuffer(84);
    new DataView(ab).setUint32(80, 0, true);
    const result = parseSTL(ab);
    expect(result.is_valid).toBe(false);
  });
});
