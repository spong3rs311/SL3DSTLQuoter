// Client-side STL parser. Runs in browser; all APIs used are available in Node 20 for tests.
// The volume_cm3 output is consumed by the pricing formula in api/lib/pricing.js (server)
// and the inline copy in widget.js (client). Keep those formulas in sync.

function parseSTL(arrayBuffer) {
  if (!arrayBuffer || arrayBuffer.byteLength < 84) {
    return { volume_cm3: 0, bbox: null, supports_likely: false, is_valid: false,
             error: 'File too small to be a valid STL' };
  }

  try {
    const triangles = isBinary(arrayBuffer) ? parseBinary(arrayBuffer) : parseASCII(arrayBuffer);

    if (triangles.length === 0) {
      return { volume_cm3: 0, bbox: null, supports_likely: false, is_valid: false,
               error: 'No triangles found in STL file' };
    }

    return computeResults(triangles);
  } catch (err) {
    return { volume_cm3: 0, bbox: null, supports_likely: false, is_valid: false,
             error: err.message };
  }
}

// Binary STL detection: file size must equal 84 + triangle_count * 50
function isBinary(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const triangleCount = view.getUint32(80, true);
  return arrayBuffer.byteLength === 84 + triangleCount * 50;
}

function parseBinary(arrayBuffer) {
  const view = new DataView(arrayBuffer);
  const count = view.getUint32(80, true);
  const triangles = [];

  let off = 84;
  for (let i = 0; i < count; i++) {
    const nz = view.getFloat32(off + 8, true);
    triangles.push({
      nz,
      v1: [view.getFloat32(off + 12, true), view.getFloat32(off + 16, true), view.getFloat32(off + 20, true)],
      v2: [view.getFloat32(off + 24, true), view.getFloat32(off + 28, true), view.getFloat32(off + 32, true)],
      v3: [view.getFloat32(off + 36, true), view.getFloat32(off + 40, true), view.getFloat32(off + 44, true)],
    });
    off += 50;
  }

  return triangles;
}

function parseASCII(arrayBuffer) {
  const text = new TextDecoder().decode(arrayBuffer);
  const triangles = [];

  // Matches each facet block including normal and 3 vertices
  const re = /facet\s+normal\s+([\S]+)\s+([\S]+)\s+([\S]+)\s+outer\s+loop\s+vertex\s+([\S]+)\s+([\S]+)\s+([\S]+)\s+vertex\s+([\S]+)\s+([\S]+)\s+([\S]+)\s+vertex\s+([\S]+)\s+([\S]+)\s+([\S]+)/gi;

  let m;
  while ((m = re.exec(text)) !== null) {
    triangles.push({
      nz: parseFloat(m[3]),
      v1: [parseFloat(m[4]),  parseFloat(m[5]),  parseFloat(m[6])],
      v2: [parseFloat(m[7]),  parseFloat(m[8]),  parseFloat(m[9])],
      v3: [parseFloat(m[10]), parseFloat(m[11]), parseFloat(m[12])],
    });
  }

  return triangles;
}

function computeResults(triangles) {
  let signedVolume = 0;
  let supports_likely = false;
  let minX = Infinity,  minY = Infinity,  minZ = Infinity;
  let maxX = -Infinity, maxY = -Infinity, maxZ = -Infinity;

  for (const { nz, v1, v2, v3 } of triangles) {
    // Signed tetrahedra volume (divergence theorem) — exact for closed meshes
    signedVolume +=
      (v1[0] * (v2[1] * v3[2] - v2[2] * v3[1]) +
       v1[1] * (v2[2] * v3[0] - v2[0] * v3[2]) +
       v1[2] * (v2[0] * v3[1] - v2[1] * v3[0])) / 6;

    // Support heuristic: stored face normal Z < -0.5 means overhang > ~60°
    if (nz < -0.5) supports_likely = true;

    for (const v of [v1, v2, v3]) {
      if (v[0] < minX) minX = v[0];
      if (v[0] > maxX) maxX = v[0];
      if (v[1] < minY) minY = v[1];
      if (v[1] > maxY) maxY = v[1];
      if (v[2] < minZ) minZ = v[2];
      if (v[2] > maxZ) maxZ = v[2];
    }
  }

  const volume_cm3 = Math.abs(signedVolume) / 1000; // mm³ → cm³
  const is_valid = volume_cm3 > 0;

  return {
    volume_cm3,
    is_valid,
    supports_likely,
    bbox: {
      x: maxX - minX,
      y: maxY - minY,
      z: maxZ - minZ,
      min: [minX, minY, minZ],
      max: [maxX, maxY, maxZ],
    },
  };
}

module.exports = { parseSTL };
