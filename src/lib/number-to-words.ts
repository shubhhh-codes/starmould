const ONES = [
  "",
  "One",
  "Two",
  "Three",
  "Four",
  "Five",
  "Six",
  "Seven",
  "Eight",
  "Nine",
  "Ten",
  "Eleven",
  "Twelve",
  "Thirteen",
  "Fourteen",
  "Fifteen",
  "Sixteen",
  "Seventeen",
  "Eighteen",
  "Nineteen",
];

const TENS = [
  "",
  "",
  "Twenty",
  "Thirty",
  "Forty",
  "Fifty",
  "Sixty",
  "Seventy",
  "Eighty",
  "Ninety",
];

const B_ZERO = BigInt(0);
const B_HUNDRED = BigInt(100);
const B_THOUSAND = BigInt(1000);
const B_LAKH = BigInt(100000);
const B_CRORE = BigInt(10000000);

function convertBelowHundred(n: number): string {
  n = Math.floor(Math.abs(n)) % 100;
  if (n === 0) return "";
  if (n < 20) return ONES[n] || "";
  const ten = Math.floor(n / 10);
  const rem = n % 10;
  return ((TENS[ten] || "") + (rem > 0 ? " " + (ONES[rem] || "") : "")).trim();
}

function convertBelowThousand(n: number): string {
  n = Math.floor(Math.abs(n)) % 1000;
  if (n === 0) return "";
  const hundred = Math.floor(n / 100);
  const rem = n % 100;
  const hundredStr = hundred > 0 ? (ONES[hundred] || "") + " Hundred" : "";
  const remStr = convertBelowHundred(rem);
  return [hundredStr, remStr].filter(Boolean).join(" ");
}

function convertBigInt(n: bigint): string {
  if (n <= B_ZERO) return "";
  if (n < B_HUNDRED) return convertBelowHundred(Number(n));
  if (n < B_THOUSAND) return convertBelowThousand(Number(n));

  const parts: string[] = [];

  const crore = n / B_CRORE;
  n = n % B_CRORE;

  const lakh = n / B_LAKH;
  n = n % B_LAKH;

  const thousand = n / B_THOUSAND;
  n = n % B_THOUSAND;

  const remainder = Number(n);

  if (crore > B_ZERO) {
    parts.push(convertBigInt(crore) + " Crore");
  }
  if (lakh > B_ZERO) {
    parts.push(convertBelowHundred(Number(lakh)) + " Lakh");
  }
  if (thousand > B_ZERO) {
    parts.push(convertBelowHundred(Number(thousand)) + " Thousand");
  }
  if (remainder > 0) {
    parts.push(convertBelowThousand(remainder));
  }

  return parts.filter(Boolean).join(" ");
}

/**
 * Converts a numeric amount to Indian Rupee Words (e.g. 5310 -> "Five Thousand Three Hundred Ten Rupees Only")
 * Accurately handles small and large amounts without integer overflow or undefined words.
 */
export function amountInWords(num: number | string | null | undefined): string {
  if (num === null || num === undefined) return "Zero Rupees Only";
  const parsed = typeof num === "string" ? parseFloat(num) : num;
  if (isNaN(parsed) || parsed <= 0) return "Zero Rupees Only";

  const rounded = Math.round(parsed * 100) / 100;
  const integerPart = Math.floor(rounded);
  const decimalPart = Math.round((rounded - integerPart) * 100);

  let words = "";
  try {
    const bi = BigInt(Math.trunc(integerPart));
    words = convertBigInt(bi);
  } catch {
    words = "";
  }

  words = words.trim();
  if (!words) words = "Zero";
  words += integerPart === 1 ? " Rupee" : " Rupees";

  if (decimalPart > 0 && decimalPart < 100) {
    const paiseWords = convertBelowHundred(decimalPart);
    if (paiseWords) {
      words += " and " + paiseWords + (decimalPart === 1 ? " Paisa" : " Paise");
    }
  }

  return words + " Only";
}
