// Convert dollars to cents (for DB writes)
function toCents(dollars) {
  return Math.round(Number(dollars) * 100);
}

// Convert cents to dollars (for API responses)
function toDollars(cents) {
  return Number((cents / 100).toFixed(2));
}

module.exports = { toCents, toDollars };
