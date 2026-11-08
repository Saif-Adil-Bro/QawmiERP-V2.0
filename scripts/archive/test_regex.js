function isArabicText(text) {
  if (!text) return false;
  return /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/.test(text);
}
console.log(isArabicText("ما معنى العمل الصالح وما فضله عند الله تعالى؟ أولاً:"));
