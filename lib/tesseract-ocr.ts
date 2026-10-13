import { createWorker } from "tesseract.js";

export interface OCRProgress {
  status: string;
  progress: number;
}

/**
 * Parses raw extracted text into structured QuestionPaperData
 */
export function parseRawTextToQuestionPaper(
  rawText: string,
  madrasaName: string = "কওমি মাদরাসা"
) {
  const lines = rawText
    .split("\n")
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  let examName = "সাময়িক / বার্ষিক পরীক্ষা";
  let subject = "সাধারণ বিষয়";
  let className = "হিফজ / কিতাব বিভাগ";
  let time = "২ ঘণ্টা ৩০ মিনিট";
  let totalMarks = "১০০";
  let generalInstructions = "সবগুলো প্রশ্নের উত্তর দাও।";

  // Try extracting headers if detected
  for (const line of lines.slice(0, 8)) {
    if (line.includes("বিষয়") || line.includes("বিষয়:") || line.includes("বিষয়")) {
      subject = line.replace(/.*(?:বিষয়|বিষয়)[:\s-]*/, "").trim() || subject;
    }
    if (line.includes("শ্রেণি") || line.includes("শ্রেণী") || line.includes("জামাত")) {
      className = line.replace(/.*(?:শ্রেণি|শ্রেণী|জামাত)[:\s-]*/, "").trim() || className;
    }
    if (line.includes("সময়") || line.includes("সময়")) {
      time = line.replace(/.*(?:সময়|সময়)[:\s-]*/, "").trim() || time;
    }
    if (line.includes("পূর্ণমান") || line.includes("মোট নম্বর") || line.includes("মান")) {
      totalMarks = line.replace(/.*(?:পূর্ণমান|মোট নম্বর|মান)[:\s-]*/, "").trim() || totalMarks;
    }
    if (line.includes("পরীক্ষা")) {
      examName = line;
    }
    if (line.includes("উত্তর দাও") || line.includes("জ্ঞাপক") || line.includes("নির্দেশ")) {
      generalInstructions = line;
    }
  }

  // Parse questions
  const questionPattern = /^([১-৯][০-৯]?|[1-9][0-9]?)[।.)\s-]/;
  const questions: any[] = [];
  let currentQ: any = null;

  lines.forEach((line) => {
    const match = line.match(questionPattern);
    if (match) {
      if (currentQ) {
        questions.push(currentQ);
      }
      const qNum = match[1];
      const qText = line.replace(questionPattern, "").trim();

      // Check if line ends with marks like [১০], (৫), ইত্যাদি
      const marksMatch = qText.match(/[\[(]([০-৯0-9]+)[\])]$/);
      let marks = "১০";
      let cleanText = qText;
      if (marksMatch) {
        marks = marksMatch[1];
        cleanText = qText.replace(/[\[(][০-৯0-9]+[\])]$/, "").trim();
      }

      currentQ = {
        id: `q_${Date.now()}_${questions.length + 1}`,
        questionNo: qNum,
        marks: marks,
        questionText: cleanText || `প্রশ্ন ${qNum}`,
        arabicText: null,
        subQuestions: [],
        table: null,
      };
    } else if (currentQ) {
      // Check for subquestions like (ক), ক., (a), a.
      const subMatch = line.match(/^[\(（]?([ক-হa-eA-EivxIVX]+)[\)）।.]\s*(.*)/);
      if (subMatch) {
        const subLabel = subMatch[1];
        const subContent = subMatch[2];
        const subMarksMatch = subContent.match(/[\[(]([০-৯0-9]+)[\])]$/);
        let subMarks = "";
        let cleanSubText = subContent;
        if (subMarksMatch) {
          subMarks = subMarksMatch[1];
          cleanSubText = subContent.replace(/[\[(][০-৯0-9]+[\])]$/, "").trim();
        }

        currentQ.subQuestions.push({
          label: subLabel,
          text: cleanSubText,
          marks: subMarks || undefined,
        });
      } else {
        // Append to question text
        currentQ.questionText += " " + line;
      }
    }
  });

  if (currentQ) {
    questions.push(currentQ);
  }

  // Fallback if no numbered questions found
  if (questions.length === 0) {
    questions.push({
      id: `q_${Date.now()}_1`,
      questionNo: "১",
      marks: totalMarks,
      questionText: rawText.trim() || "স্ক্যানকৃত প্রশ্ন টেক্সট",
      arabicText: null,
      subQuestions: [],
      table: null,
    });
  }

  return {
    header: {
      madrasaName: madrasaName || "কওমি মাদরাসা",
      examName,
      subject,
      className,
      time,
      totalMarks,
      bismillahText: "بِسْمِ اللَّهِ الرَّحْمٰنِ الرَّحِيمِ",
    },
    generalInstructions,
    questions,
    rawSummary: `Tesseract OCR স্ক্যানকৃত প্রশ্নপত্র (${questions.length}টি প্রশ্ন শনাক্ত)`,
    rawText: rawText,
    engineUsed: "tesseract" as const,
  };
}

/**
 * Translates Tesseract internal status to clear Bengali instructions
 */
export function getBengaliStatusText(status: string): string {
  const lower = status.toLowerCase();
  if (lower.includes("loading tesseract core")) return "Tesseract ওসিআর কোর ইঞ্জিন প্রস্তুত হচ্ছে...";
  if (lower.includes("initializing tesseract")) return "ইঞ্জিন ইনিশিয়ালাইজ হচ্ছে...";
  if (lower.includes("loading language traineddata")) return "বাংলা ও প্রয়োজনীয় ভাষার ডিকশনারি লোড হচ্ছে...";
  if (lower.includes("loaded language traineddata")) return "ভাষার ডিকশনারি লোড সম্পন্ন হয়েছে...";
  if (lower.includes("initializing api")) return "ওসিআর এপিআই প্রস্তুত হচ্ছে...";
  if (lower.includes("recognizing text")) return "ছবি থেকে বাংলা ও ইংরেজি টেক্সট রিকগনাইজ করা হচ্ছে...";
  return status || "প্রসেসিং হচ্ছে...";
}

/**
 * Runs free Tesseract OCR in browser
 */
export async function runTesseractOCR(
  imageSource: string | File,
  languages: string = "ben+eng",
  onProgress?: (progress: OCRProgress) => void
): Promise<{ text: string; confidence: number }> {
  const worker = await createWorker(languages, 1, {
    logger: (m) => {
      if (onProgress && m) {
        onProgress({
          status: getBengaliStatusText(m.status || "প্রসেসিং..."),
          progress: typeof m.progress === "number" ? Math.round(m.progress * 100) : 0,
        });
      }
    },
  });

  try {
    const ret = await worker.recognize(imageSource);
    return {
      text: ret.data.text,
      confidence: ret.data.confidence,
    };
  } finally {
    await worker.terminate();
  }
}
