export type ColumnLayout = "1_column" | "2_column";
export type ColumnDivider = "solid" | "dashed" | "double" | "none";
export type CalligraphyStyle = "thuluth_classic" | "ornate_frame" | "bismillah_hamd" | "riqa_simple" | "none";
export type BorderStyle = "none" | "double_classic" | "islamic_corner" | "decorative_vintage" | "simple_box";
export type PaperSize = "a4" | "legal" | "folio";
export type PaperOrientation = "portrait" | "landscape";
export type LogoPosition = "left" | "center_top" | "right" | "dual";

export interface PaperDesignConfig {
  columnLayout: ColumnLayout;
  columnDivider: ColumnDivider;
  calligraphyStyle: CalligraphyStyle;
  showLogo: boolean;
  logoUrl: string;
  logoPosition: LogoPosition;
  logoSize: "sm" | "md" | "lg";
  borderStyle: BorderStyle;
  paperSize: PaperSize;
  paperOrientation: PaperOrientation;
  compactSpacing: boolean;
  fontSize: "sm" | "base" | "lg";
}

export const DEFAULT_PAPER_DESIGN: PaperDesignConfig = {
  columnLayout: "2_column",
  columnDivider: "solid",
  calligraphyStyle: "ornate_frame",
  showLogo: true,
  logoUrl: "",
  logoPosition: "left",
  logoSize: "md",
  borderStyle: "double_classic",
  paperSize: "a4",
  paperOrientation: "portrait",
  compactSpacing: true,
  fontSize: "base",
};

export const CALLIGRAPHY_TEXTS = {
  thuluth_classic: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  ornate_frame: "بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ",
  bismillah_hamd: "بِسْمِ اللهِ الرَّحْمٰنِ الرَّحِيْمِ • نَحْمَدُهُ وَنُصَلِّيْ عَلَىٰ رَسُوْلِهِ الْكَرِيْمِ",
  riqa_simple: "بسم الله الرحمن الرحيم",
  none: "",
};
