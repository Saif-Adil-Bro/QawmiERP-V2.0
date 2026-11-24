import {
  DEFAULT_FEE_TYPES,
  type FeeType,
  type MadrasaFeeData,
} from "@/lib/fee-management";

// Price the same pupil the same way in the manual and scheduled generators.
// An explicit manual type/amount overrides the schedule; an agreed profile rate
// still wins. Auto-generation never invents a schedule from virtual examples.
export function monthlyCharges(
  meta: MadrasaFeeData,
  student: Record<string, any>,
  params: {
    sessionId: string;
    feeTypeIds?: string[];
    customAmounts?: Record<string, number>;
    syncStudentProfiles?: boolean;
    auto?: boolean;
  },
) {
  const studentProfile = meta.student_profiles?.[student.id],
    shouldSyncProfiles = params.syncStudentProfiles !== false;
  if (
    [
      student.status,
      student.student_status,
      studentProfile?.student_status,
    ].some(
      (s) =>
        s &&
        !["ACTIVE", "SCHOLARSHIP", "IRREGULAR"].includes(
          String(s).toUpperCase(),
        ),
    )
  )
    return [];
  const category =
    studentProfile?.student_category ||
    (
      {
        আবাসিক: "RESIDENTIAL",
        অনাবাসিক: "NON_RESIDENTIAL",
        "ডে-কেয়ার": "DAY_CARE",
      } as Record<string, string>
    )[studentProfile?.residential_status || student.residential_status] ||
    student.student_category;
  const available = (meta.fee_structures || []).filter(
    (s) =>
      s.session_id === params.sessionId &&
      (s.class_id === student.class_id || s.class_id === "ALL"),
  );
  const compatible = available.filter(
    (s) =>
      !s.student_category ||
      s.student_category === "ALL" ||
      s.student_category === category,
  );
  const byClass = compatible.filter((s) => s.class_id === student.class_id),
    pool = byClass.length ? byClass : compatible;
  const byCategory = pool.filter(
      (s) => category && s.student_category === category,
    ),
    chosen = byCategory.length ? byCategory : pool;
  if (chosen.length > 1 || (available.length && !chosen.length && !category))
    throw Error(
      "শিক্ষার্থীর ফি কাঠামো নির্দিষ্ট নয়। আগে শ্রেণি ও ক্যাটাগরি যাচাই করুন।",
    );
  const matchingStruct = chosen[0],
    types = meta.fee_types || DEFAULT_FEE_TYPES;
  const targets = params.feeTypeIds?.length
    ? params.feeTypeIds
    : matchingStruct
      ? matchingStruct.items
          .filter((i) => i.frequency === "MONTHLY")
          .map((i) => i.fee_type_id)
      : available.length || (params.auto && types === DEFAULT_FEE_TYPES)
        ? []
        : types
            .filter(
              (t) =>
                t.is_active !== false &&
                (!params.auto || !t.is_system) &&
                (t.frequency === "MONTHLY" || t.code === "MONTHLY"),
            )
            .map((t) => t.id);
  const selectedFeeTypes = types.filter(
    (t) => t.is_active !== false && targets.includes(t.id),
  );
  if (
    new Set(targets).size !== targets.length ||
    selectedFeeTypes.length !== targets.length
  )
    throw Error("ফি কাঠামোর খাত অনুপস্থিত, স্থগিত বা একাধিক।");
  const charges: {
    ft: FeeType;
    baseAmount: number;
    discountAmount: number;
    discountReason: string;
    payable: number;
  }[] = [];
  // Student discounts/waivers from discounts array or individual student profile

  const studentDiscounts = (meta.discounts || []).filter(
    (d) =>
      d.student_id === student.id &&
      (!d.session_id || d.session_id === params.sessionId) &&
      d.status === "APPROVED",
  );

  // Determine general discount pool (applied across fee types without double-discounting)
  if (
    new Set(studentDiscounts.map((d) => d.fee_type_id || "")).size !==
    studentDiscounts.length
  )
    throw Error("একই খাতে একাধিক ছাড় পাওয়া গেছে।");
  const generalDiscount = studentDiscounts.find((d) => !d.fee_type_id);
  let isGeneralFullWaiver = false;
  let generalPercentage = 0;
  let remainingGeneralDiscount = 0;
  let generalDiscountReason = "";

  if (generalDiscount) {
    if (generalDiscount.discount_type === "FULL_WAIVER") {
      isGeneralFullWaiver = true;
      generalDiscountReason = generalDiscount.reason || "পূর্ণ মওকুফ";
    } else if (generalDiscount.discount_type === "PERCENTAGE") {
      generalPercentage = Number(generalDiscount.value || 0);
      generalDiscountReason = `${generalDiscount.value}% বিশেষ ছাড়`;
    } else if (generalDiscount.discount_type === "FIXED") {
      remainingGeneralDiscount = Number(generalDiscount.value || 0);
      generalDiscountReason = generalDiscount.reason || "নির্ধারিত মাসিক ছাড়";
    }
  } else if (shouldSyncProfiles && studentProfile) {
    const boardingLabel = String(studentProfile.boarding_type || "");
    const hasAnyDefinedFeeField =
      (studentProfile.monthly_fee !== undefined &&
        studentProfile.monthly_fee !== null &&
        studentProfile.monthly_fee !== "") ||
      (studentProfile.khoraki_fee !== undefined &&
        studentProfile.khoraki_fee !== null &&
        studentProfile.khoraki_fee !== "") ||
      (studentProfile.accommodation_fee !== undefined &&
        studentProfile.accommodation_fee !== null &&
        studentProfile.accommodation_fee !== "") ||
      (studentProfile.transport_fee !== undefined &&
        studentProfile.transport_fee !== null &&
        studentProfile.transport_fee !== "") ||
      (studentProfile.other_fee !== undefined &&
        studentProfile.other_fee !== null &&
        studentProfile.other_fee !== "") ||
      (studentProfile.total_monthly_fee !== undefined &&
        studentProfile.total_monthly_fee !== null &&
        studentProfile.total_monthly_fee !== "");

    // F2 (B18): Full student profiles created by confirmAdmissionToStudent or createStudent
    // always include `first_name` / `student_status` / `boarding_type`. If their fee fields were left
    // unset (or set to 0), their hydrated profile fee in the UI is ৳0 and must be honored as a ৳0 contract.
    const isFullStudentProfileRecord =
      hasAnyDefinedFeeField ||
      Boolean(studentProfile.first_name) ||
      Boolean(studentProfile.student_status) ||
      Boolean(studentProfile.boarding_type);

    const hydratedMonthly = Number(studentProfile.monthly_fee || 0);
    const hydratedKhoraki = Number(studentProfile.khoraki_fee || 0);
    const hydratedAccommodation = Number(studentProfile.accommodation_fee || 0);
    const hydratedTransport = Number(studentProfile.transport_fee || 0);
    const hydratedOther = Number(studentProfile.other_fee || 0);
    const hydratedTotal =
      studentProfile.total_monthly_fee !== undefined &&
      studentProfile.total_monthly_fee !== null &&
      studentProfile.total_monthly_fee !== ""
        ? Number(studentProfile.total_monthly_fee)
        : Math.max(
            0,
            hydratedMonthly +
              hydratedKhoraki +
              hydratedAccommodation +
              hydratedTransport +
              hydratedOther -
              Number(studentProfile.fee_discount || 0),
          );

    const hasZeroHydratedAgreement =
      isFullStudentProfileRecord &&
      hydratedTotal === 0 &&
      hydratedMonthly === 0 &&
      hydratedKhoraki === 0 &&
      hydratedAccommodation === 0 &&
      hydratedTransport === 0 &&
      hydratedOther === 0;

    const isFreeStudent =
      studentProfile.is_free === true ||
      studentProfile.free_student === true ||
      studentProfile.student_status === "SCHOLARSHIP" ||
      boardingLabel.includes("লিল্লাহ") ||
      hasZeroHydratedAgreement;

    if (isFreeStudent) {
      isGeneralFullWaiver = true;
      generalDiscountReason =
        studentProfile.fee_discount_reason ||
        (boardingLabel.includes("লিল্লাহ")
          ? "লিল্লাহ বোর্ডিং / ১০০% ফ্রি শিক্ষার্থী"
          : !hasAnyDefinedFeeField
            ? "প্রোফাইলে নির্ধারিত ফি ৳০ (চুক্তি অনুযায়ী মওকুফ)"
            : "৳০ ফি-চুক্তি / ১০০% মওকুফ শিক্ষার্থী");
    } else if (
      studentProfile.fee_discount &&
      Number(studentProfile.fee_discount) > 0
    ) {
      remainingGeneralDiscount = Number(studentProfile.fee_discount);
      generalDiscountReason =
        studentProfile.fee_discount_reason ||
        "শিক্ষার্থী প্রোফাইল ভিত্তিক ছাড় / মওকুফ";
    }
  }

  const hasProfileFeeContract =
    Boolean(shouldSyncProfiles && studentProfile) &&
    ((studentProfile.monthly_fee !== undefined &&
      studentProfile.monthly_fee !== null &&
      studentProfile.monthly_fee !== "") ||
      (studentProfile.khoraki_fee !== undefined &&
        studentProfile.khoraki_fee !== null &&
        studentProfile.khoraki_fee !== "") ||
      (studentProfile.accommodation_fee !== undefined &&
        studentProfile.accommodation_fee !== null &&
        studentProfile.accommodation_fee !== "") ||
      (studentProfile.transport_fee !== undefined &&
        studentProfile.transport_fee !== null &&
        studentProfile.transport_fee !== "") ||
      (studentProfile.other_fee !== undefined &&
        studentProfile.other_fee !== null &&
        studentProfile.other_fee !== "") ||
      (studentProfile.total_monthly_fee !== undefined &&
        studentProfile.total_monthly_fee !== null &&
        studentProfile.total_monthly_fee !== "") ||
      Boolean(studentProfile.first_name) ||
      Boolean(studentProfile.student_status) ||
      Boolean(studentProfile.boarding_type));

  for (const ft of selectedFeeTypes) {
    let baseAmount = ft.default_amount || 0;
    const ftCode = (ft.code || "").toUpperCase();
    const ftCat = (ft.category || "").toUpperCase();
    const ftName = ft.name || "";

    const isTuition =
      ftCat === "TUITION" ||
      ftCode === "MONTHLY" ||
      ftName.includes("বেতন") ||
      ftName.includes("টিউশন");
    const isFood =
      ftCat === "BOARDING" ||
      ftCode === "HOSTEL" ||
      ftCode === "FOOD" ||
      ftName.includes("খাবার") ||
      ftName.includes("খোরাকি") ||
      ftName.includes("বোর্ডিং");
    const isHostel =
      ftCat === "HOSTEL" ||
      ftName.includes("আবাসন") ||
      ftName.includes("সিট") ||
      ftName.includes("হোস্টেল");
    const isTransport =
      ftCat === "TRANSPORT" ||
      ftCode === "TRANSPORT" ||
      ftName.includes("পরিবহন") ||
      ftName.includes("গাড়ি");
    const isAdmission =
      ftCat === "ADMISSION" ||
      ftCode === "ADMISSION" ||
      ftName.includes("ভর্তি");
    const isOther =
      ftCat === "OTHER" ||
      ftCode === "OTHER" ||
      ftName.includes("অন্যান্য") ||
      ftName.includes("বিবিধ");

    // 1. Check student individual profile agreed fee (from admission or student edit)
    let profileAgreedFee: number | undefined = undefined;
    if (shouldSyncProfiles && studentProfile && hasProfileFeeContract) {
      if (isTuition) {
        profileAgreedFee =
          studentProfile.monthly_fee !== undefined &&
          studentProfile.monthly_fee !== null &&
          studentProfile.monthly_fee !== ""
            ? Number(studentProfile.monthly_fee)
            : 0;
      } else if (isFood) {
        profileAgreedFee =
          studentProfile.khoraki_fee !== undefined &&
          studentProfile.khoraki_fee !== null &&
          studentProfile.khoraki_fee !== ""
            ? Number(studentProfile.khoraki_fee)
            : 0;
      } else if (isHostel) {
        profileAgreedFee =
          studentProfile.accommodation_fee !== undefined &&
          studentProfile.accommodation_fee !== null &&
          studentProfile.accommodation_fee !== ""
            ? Number(studentProfile.accommodation_fee)
            : 0;
      } else if (isTransport) {
        profileAgreedFee =
          studentProfile.transport_fee !== undefined &&
          studentProfile.transport_fee !== null &&
          studentProfile.transport_fee !== ""
            ? Number(studentProfile.transport_fee)
            : 0;
      } else if (
        isAdmission &&
        studentProfile.admission_fee !== undefined &&
        studentProfile.admission_fee !== null
      ) {
        profileAgreedFee = Number(studentProfile.admission_fee);
      } else if (
        isOther &&
        studentProfile.other_fee !== undefined &&
        studentProfile.other_fee !== null
      ) {
        profileAgreedFee = Number(studentProfile.other_fee);
      }
    }

    if (profileAgreedFee !== undefined && !isNaN(profileAgreedFee)) {
      // Individual contract takes precedence
      baseAmount = profileAgreedFee;
    } else if (
      params.customAmounts &&
      params.customAmounts[ft.id] !== undefined &&
      !isNaN(Number(params.customAmounts[ft.id]))
    ) {
      // Generator custom amount override
      baseAmount = Number(params.customAmounts[ft.id]);
    } else if (matchingStruct) {
      const sItem = matchingStruct.items.find((it) => it.fee_type_id === ft.id);
      if (sItem && sItem.amount >= 0) {
        baseAmount = sItem.amount;
      }
    }

    if (
      !Number.isFinite(baseAmount) ||
      baseAmount < 0 ||
      Math.abs(baseAmount * 100 - Math.round(baseAmount * 100)) > 0.000001
    )
      throw Error("ফি-এর অঙ্ক পয়সা পর্যন্ত যাচাই করুন।");

    // 2. Calculate discount & waiver (মওকুফ / বিশেষ ছাড়)
    let discountAmount = 0;
    let discountReason = "";

    // Check if there is a specific discount for this exact fee type
    const specificDiscount = studentDiscounts.find(
      (d) => d.fee_type_id === ft.id,
    );

    if (specificDiscount) {
      if (specificDiscount.discount_type === "FULL_WAIVER") {
        discountAmount = baseAmount;
        discountReason = specificDiscount.reason || "পূর্ণ মওকুফ";
      } else if (specificDiscount.discount_type === "PERCENTAGE") {
        discountAmount =
          Math.round(baseAmount * Number(specificDiscount.value || 0)) / 100;
        discountReason = `${specificDiscount.value}% বিশেষ ছাড়`;
      } else if (specificDiscount.discount_type === "FIXED") {
        discountAmount = Math.min(
          baseAmount,
          Number(specificDiscount.value || 0),
        );
        discountReason = specificDiscount.reason || "নির্ধারিত ছাড়";
      }
    } else if (isGeneralFullWaiver) {
      discountAmount = baseAmount;
      discountReason = generalDiscountReason || "পূর্ণ মওকুফ";
    } else if (generalPercentage > 0) {
      discountAmount = Math.round(baseAmount * generalPercentage) / 100;
      discountReason =
        generalDiscountReason || `${generalPercentage}% বিশেষ ছাড়`;
    } else if (remainingGeneralDiscount > 0) {
      // Apply pool-based discount without exceeding total student general discount
      discountAmount = Math.min(baseAmount, remainingGeneralDiscount);
      remainingGeneralDiscount =
        Math.round((remainingGeneralDiscount - discountAmount) * 100) / 100;
      discountReason = generalDiscountReason || "নির্ধারিত মাসিক ছাড়";
    }

    if (discountAmount > baseAmount) discountAmount = baseAmount;
    const payable = Math.max(
      0,
      Math.round((baseAmount - discountAmount) * 100) / 100,
    );

    if (!ft.fund_id || !ft.fund_name)
      throw Error("প্রতিটি ফি খাতের সক্রিয় ফান্ড নির্বাচন করুন।");
    charges.push({ ft, baseAmount, discountAmount, discountReason, payable });
  }
  return charges;
}
