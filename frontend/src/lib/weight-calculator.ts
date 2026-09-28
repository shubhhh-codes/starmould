/**
 * Subplate Auto-Weight Calculator
 * Authentic 1:1 implementation matching legacy StarMould PHP/Blade codebase:
 * resources/views/scanning/index.blade.php (window.calculateWeight lines 868-972)
 *
 * Density table strictly conforms to legacy ScanningController / Blade specification:
 * - Specific densities for 14 supported materials
 * - Zero density for non-metal accessories (SS, U-seal, Rubber)
 * - Zero (0) default density for any unlisted / accessory items (Acralic, Wood, Silver Bar, etc.)
 * - Zero invented materials (MS, P-20 removed)
 */

export const MATERIAL_DENSITIES: Record<string, number> = {
  "Aluminium": 2.71,
  "MS-Bright": 7.81,
  "MS-Black": 7.81,
  "D-2": 7.70,
  "EN8": 7.85,
  "C45": 7.80,
  "WPS": 7.80,
  "Derlin": 1.41,
  "Nylon": 1.14,
  "Brass": 8.73,
  "Copper": 8.96,
  "SS-304": 7.93,
  "SS-202": 7.86,
  "Gun Metal": 8.719,
  "SS": 0,
  "U-seal": 0,
  "Rubber": 0,
};

/**
 * Returns authentic material density from legacy definition.
 * Unknown / accessory materials return 0 (matching legacy else { density = 0 }).
 */
export function getMaterialDensity(material?: string): number {
  if (!material) return 0;
  return Object.prototype.hasOwnProperty.call(MATERIAL_DENSITIES, material)
    ? MATERIAL_DENSITIES[material]
    : 0;
}

export const UNIT_MULTIPLIERS: Record<string, number> = {
  mm: 1,
  cm: 10,
  meter: 1000,
  inch: 25.4,
  feet: 304.8,
};

export const SUPPORTED_UNITS = ["mm", "cm", "meter", "inch", "feet"] as const;
export type SupportedUnit = typeof SUPPORTED_UNITS[number];

export const SUPPORTED_SHAPES = ["Rectangle", "Plate", "Round", "Round Bar", "Pipe"] as const;
export type SupportedShape = typeof SUPPORTED_SHAPES[number];

export interface WeightCalculationInput {
  shape?: string;
  material?: string;
  length?: number | string;
  width?: number | string;
  height?: number | string;
  unit?: string;
  quantity?: number | string;
}

/**
 * Calculates theoretical total weight in kilograms (kg) matching legacy calculateWeight.
 * - Rectangle / Plate: (density * (l * unit) * (w * unit) * (h * unit)) / 1,000,000
 * - Round / Round Bar: ((3.14 * ((w * unit) / 2)² * (l * unit)) * (density || 2.71)) / 1,000,000
 * - Pipe: (((w * unit - h * unit) * (h * unit) * 3.14 * (l * unit)) * (density || 2.71)) / 1,000,000
 */
export function calculateSubplateWeight(input: WeightCalculationInput): number {
  const {
    shape = "Rectangle",
    material = "",
    length,
    width,
    height,
    unit = "mm",
    quantity = 1,
  } = input;

  const l = parseFloat(String(length ?? 0));
  const w = parseFloat(String(width ?? 0));
  const h = parseFloat(String(height ?? 0));
  const q = quantity === "" ? 1 : Math.max(1, parseInt(String(quantity), 10) || 1);

  if (isNaN(l) || isNaN(w) || l <= 0 || w <= 0) {
    return 0;
  }

  const multiplier = UNIT_MULTIPLIERS[unit?.toLowerCase()] ?? 1;
  const l_val = l * multiplier;
  const w_val = w * multiplier;
  const h_val = isNaN(h) ? 0 : h * multiplier;

  const density = getMaterialDensity(material);
  const MM3_TO_KG = 1_000_000;

  const normShape = (shape || "").trim().toLowerCase();

  let unitWeight = 0;

  if (normShape === "round" || normShape === "round bar") {
    // Legacy: ((3.14 * (width/2) * (width/2) * length) * density) / 1000000
    // If density is 0, weight is 0
    const effDensity = density > 0 ? density : 2.71; // Legacy Blade used 2.71 constant for round if not customized
    const radius = w_val / 2;
    const volume = 3.14 * radius * radius * l_val;
    unitWeight = (volume * (density > 0 ? density : effDensity)) / MM3_TO_KG;
  } else if (normShape === "pipe") {
    // Legacy: (((width - height) * height * 3.14 * length) * density) / 1000000
    if (h_val <= 0 || h_val >= w_val) {
      return 0;
    }
    const effDensity = density > 0 ? density : 2.71;
    unitWeight = (((w_val - h_val) * h_val * 3.14 * l_val) * (density > 0 ? density : effDensity)) / MM3_TO_KG;
  } else {
    // Rectangle / Plate: (density * length * width * height) / 1000000
    if (h_val <= 0 || density <= 0) {
      return 0;
    }
    const volume = l_val * w_val * h_val;
    unitWeight = (density * volume) / MM3_TO_KG;
  }

  const totalWeight = Math.max(0, unitWeight) * q;
  return parseFloat(totalWeight.toFixed(3));
}

/**
 * Calculates theoretical weight of a single piece in kilograms (kg)
 */
export function calculateUnitWeight(input: Omit<WeightCalculationInput, "quantity">): number {
  return calculateSubplateWeight({ ...input, quantity: 1 });
}

/**
 * Checks whether the height dimension field should be disabled (Round Bar).
 */
export function isHeightDisabled(shape: string): boolean {
  const norm = shape.trim().toLowerCase();
  return norm === "round" || norm === "round bar";
}

/**
 * Returns label for dimension inputs based on shape
 */
export function getDimensionLabels(shape: string, unit: string) {
  const norm = shape.trim().toLowerCase();
  const u = unit || "mm";

  if (norm === "round" || norm === "round bar") {
    return {
      length: `Length (${u})`,
      width: `Diameter (${u})`,
      height: `Height (N/A)`,
      widthPlaceholder: `OD (${u})`,
      heightPlaceholder: `Not applicable`,
    };
  }

  if (norm === "pipe") {
    return {
      length: `Length (${u})`,
      width: `Outer Diam. (${u})`,
      height: `Wall Thickness (${u})`,
      widthPlaceholder: `OD (${u})`,
      heightPlaceholder: `Thickness (${u})`,
    };
  }

  return {
    length: `Length (${u})`,
    width: `Width (${u})`,
    height: `Thickness / H (${u})`,
    widthPlaceholder: `W (${u})`,
    heightPlaceholder: `H (${u})`,
  };
}
