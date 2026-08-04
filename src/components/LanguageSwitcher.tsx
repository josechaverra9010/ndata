import { useI18n, type Locale } from "@/lib/i18n";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Languages } from "lucide-react";

export function LanguageSwitcher({ compact = false }: { compact?: boolean }) {
  const { locale, setLocale, t } = useI18n();

  return (
    <Select value={locale} onValueChange={(v) => setLocale(v as Locale)}>
      <SelectTrigger
        className={compact ? "h-8 w-[110px] border-0 bg-transparent shadow-none" : "h-9 w-[140px]"}
        aria-label={t("common.language")}
      >
        <Languages className="h-3.5 w-3.5 mr-1 shrink-0 opacity-70" />
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="es">{t("lang.es")}</SelectItem>
        <SelectItem value="en">{t("lang.en")}</SelectItem>
      </SelectContent>
    </Select>
  );
}
