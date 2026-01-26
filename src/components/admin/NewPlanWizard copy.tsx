// Helper function to format number with comma as decimal separator
const formatNumberWithComma = (value: string | number | undefined): string => {
  if (!value && value !== 0) return "";
  const num = typeof value === "string" ? parseFloat(value) : value;
  if (isNaN(num)) return "";
  return num.toString().replace(".", ",");
};

// Helper function to parse comma-formatted number back to dot
const parseCommaNumber = (value: string): string => {
  return value.replace(",", ".");
};
