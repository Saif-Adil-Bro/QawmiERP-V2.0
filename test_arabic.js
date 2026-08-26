function toBengaliNumerals(num) {
  const digits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}
function toArabicNumerals(num) {
  const digits = ["٠", "١", "٢", "٣", "٤", "٥", "٦", "٧", "٨", "٩"];
  return num.toString().split("").map(d => digits[parseInt(d)] || d).join("");
}
console.log("Arabic 1:", toArabicNumerals(1));
console.log("Bengali 1:", toBengaliNumerals(1));
console.log("Arabic 10:", toArabicNumerals(10));
console.log("Bengali 10:", toBengaliNumerals(10));
