/**
 * Subplate Auto-Weight Calculator
 * Reverse-engineered from legacy StarMould PHP/Blade codebase:
 * resources/views/scanning/index.blade.php (window.calculateWeight)
 *
 * Supports Plate / Rectangle, Round Bar, and Pipe geometry calculations
 * with authentic material densities (g/cm³) and 5 unit conversions (mm, cm, meter, inch, feet).
 */

export const MATERIAL_DENSITIES: Record<string, number> = {
  "Aluminium": 2.71,
  "MS-Bright": 7.81,
  "MS-Black": 7.81,
  "MS": 7.81,
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
  "SS": 7.90,
  "Acralic": 1.18,
  "Rubber": 1.10,
  "Wood": 0.70,
  "Wooden Box": 0.70,
  "Silver Bar": 10.49,
  "Spring": 7.85,
  "U-seal": 1.20,
  "O-ring": 1.20,
  "P-20": 7.85,
};

export function getMaterialDensity(material?: string): number {
  return (material && MATERIAL_DENSITIES[material]) ? MATERIAL_DENSITIES[material] : 7.81;
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

export const SUPPORTED_SHAPES = ["Plate", "Round Bar", "Pipe"] as const;
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
 * Calculates theoretical total weight in kilograms (kg)
 * taking quantity into account, rounded to 3 decimal places.
 */
export function calculateSubplateWeight(input: WeightCalculationInput): number {
  const {
    shape = "Plate",
    material = "MS-Bright",
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
  const l_mm = l * multiplier;
  const w_mm = w * multiplier;
  const h_mm = isNaN(h) ? 0 : h * multiplier;

  // Density in g/cm³
  const density = MATERIAL_DENSITIES[material] ?? 7.81;
  const MM3_TO_KG = 1_000_000;

  const normShape = shape.trim().toLowerCase();

  let unitWeight = 0;

  // 1. Round Bar (Solid Cylinder)
  // Formula: Volume = π * (Diameter / 2)² * Length
  if (normShape === "round" || normShape === "round bar") {
    const radius = w_mm / 2;
    const volume = Math.PI * radius * radius * l_mm;
    unitWeight = (volume * density) / MM3_TO_KG;
  } else if (normShape === "pipe") {
    // 2. Hollow Pipe (Tube)
    // W is Outer Diameter (OD), H is Wall Thickness or Inner Diameter (ID)
    if (h_mm <= 0 || h_mm >= w_mm) {
      return 0;
    }
    unitWeight = (((w_mm - h_mm) * h_mm * Math.PI * l_mm) * density) / MM3_TO_KG;
  } else {
    // 3. Flat Plate / Rectangle
    // Formula: Volume = Length * Width * Height
    if (h_mm <= 0) {
      return 0;
    }
    const volume = l_mm * w_mm * h_mm;
    unitWeight = (volume * density) / MM3_TO_KG;
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
 * Checks whether the height dimension field should be disabled
 * (Round Bar only requires Diameter/Width and Length).
 */
export function isHeightDisabled(shape: string): boolean {
  const norm = shape.trim().toLowerCase();
  return norm === "round" || norm === "round bar";
}

/**
 * Returns intuitive label for dimension inputs based on shape
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
