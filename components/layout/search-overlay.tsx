import { Search, X } from "lucide-react";
import { useI18n } from "@/lib/i18n";

export function SearchOverlay({ onClose }: { onClose: () => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-[100] flex flex-col items-center bg-black/80 px-4 pt-24 backdrop-blur-xl" onClick={onClose}>
      <div className="w-full max-w-xl" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center gap-3 rounded-xl border border-white/10 bg-black/25 px-5 py-3.5 backdrop-blur-xl">
          <Search className="h-[18px] w-[18px] shrink-0 text-white/40" />
          <input
            placeholder={t("searchSoon")}
            className="flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/25"
            disabled
          />
          <button aria-label={t("search")} onClick={onClose} className="text-xs uppercase tracking-wider text-white/35 transition hover:text-white/70">
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  );
}
