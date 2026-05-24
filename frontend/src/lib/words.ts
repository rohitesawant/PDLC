// Number → Indian English words for currency (lakh/crore system).
// Used to render the "Amount in words" field on invoices.

const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
const teens = ['Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function twoDigits(n: number): string {
  if (n < 10) return ones[n];
  if (n < 20) return teens[n - 10];
  const t = tens[Math.floor(n / 10)];
  const o = ones[n % 10];
  return o ? `${t} ${o}` : t;
}

function upToThreeDigits(n: number): string {
  if (n === 0) return '';
  if (n < 100) return twoDigits(n);
  const h = Math.floor(n / 100);
  const rest = n % 100;
  return `${ones[h]} Hundred${rest ? ' ' + twoDigits(rest) : ''}`;
}

function numberToIndianWords(n: number): string {
  if (!Number.isFinite(n)) return '';
  if (n === 0) return 'Zero';
  if (n < 0) return `Minus ${numberToIndianWords(-n)}`;

  const parts: string[] = [];
  const crore = Math.floor(n / 10000000); n %= 10000000;
  const lakh = Math.floor(n / 100000); n %= 100000;
  const thousand = Math.floor(n / 1000); n %= 1000;
  const hundred = n;

  if (crore) parts.push(`${twoDigits(crore)} Crore`);
  if (lakh) parts.push(`${twoDigits(lakh)} Lakh`);
  if (thousand) parts.push(`${twoDigits(thousand)} Thousand`);
  if (hundred) parts.push(upToThreeDigits(hundred));

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

export function rupeesInWords(amount: number | string | null | undefined): string {
  const n = typeof amount === 'string' ? Number(amount) : (amount ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '';
  return `${numberToIndianWords(Math.floor(n))} Rupees Only`;
}
