import { type VariantProps } from "class-variance-authority";
import { badgeVariants } from "@/components/ui/badge";

export interface ParsedTaxonomy {
  cleanTitle: string;
  tag: string | null;
  badgeVariant: VariantProps<typeof badgeVariants>["variant"];
  colorClass: string;
}

export function parseTaxonomyTag(title: string | null | undefined): ParsedTaxonomy {
  const defaultReturn: ParsedTaxonomy = {
    cleanTitle: title ?? "",
    tag: null,
    badgeVariant: "secondary",
    colorClass: "",
  };

  if (!title) return defaultReturn;

  const match = title.match(/^\[(.*?)\]\s*(.*)$/);
  if (!match) {
    // Check if it's the ARQ-XXX-TAG-NOME format without brackets
    const parts = title.split("-");
    if (parts.length >= 4) {
      // e.g. ARQ-123-FEAT-Login -> parts = ["ARQ", "123", "FEAT", "Login"]
      // Actually we just expect tags to be in brackets like [FEAT] ARQ-123 Login or ARQ-123 [FEAT] Login.
      // But let's support finding a known tag in brackets anywhere, or just at the start.
    }
    return defaultReturn;
  }

  const tag = match[1].toUpperCase();
  const cleanTitle = match[2];
  
  let badgeVariant: VariantProps<typeof badgeVariants>["variant"] = "secondary";
  let colorClass = "";

  switch (tag) {
    case "BUG":
    case "DEFECT":
      badgeVariant = "destructive";
      break;
    case "FEAT":
    case "FEATURE":
      badgeVariant = "default"; // or we can use a custom green class
      colorClass = "bg-emerald-500/10 text-emerald-500 hover:bg-emerald-500/20 border-emerald-500/20";
      break;
    case "ENH":
    case "ENHANCEMENT":
      badgeVariant = "outline";
      colorClass = "bg-blue-500/10 text-blue-500 hover:bg-blue-500/20 border-blue-500/20";
      break;
    case "SEC":
    case "SECURITY":
      badgeVariant = "outline";
      colorClass = "bg-amber-500/10 text-amber-500 hover:bg-amber-500/20 border-amber-500/20";
      break;
    case "TASK":
      badgeVariant = "secondary";
      break;
    case "DEBT":
      badgeVariant = "outline";
      colorClass = "bg-purple-500/10 text-purple-500 hover:bg-purple-500/20 border-purple-500/20";
      break;
    default:
      badgeVariant = "outline";
      break;
  }

  return {
    cleanTitle,
    tag,
    badgeVariant: colorClass ? "outline" : badgeVariant,
    colorClass,
  };
}
