import BiometricDevicesClient from "./BiometricDevicesClient";

export const metadata = {
  title: "বায়োমেট্রিক ও ফিঙ্গারপ্রিন্ট হাজিরা ডিভাইস | QawmiManager",
  description: "মাদরাসার ফিংগারপ্রিন্ট ও বায়োমেট্রিক হাজিরা ডিভাইস কনফিগারেশন, ইউজার ম্যাপিং ও ক্লাউড সিঙ্ক",
};

export default function BiometricDevicesPage() {
  return <BiometricDevicesClient />;
}
