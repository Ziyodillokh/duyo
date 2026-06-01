import { useTranslation } from "react-i18next";
import { Construction } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";

export function Placeholder({ navKey, phase }: { navKey: string; phase: string }) {
  const { t } = useTranslation();
  return (
    <div>
      <PageHeader title={t(`nav.${navKey}`)} />
      <div className="card flex flex-col items-center justify-center gap-3 p-16 text-center">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-bg text-muted">
          <Construction size={22} />
        </div>
        <div className="text-base font-semibold text-ink">{t(`nav.${navKey}`)}</div>
        <p className="max-w-sm text-sm text-muted">
          Bu modul {phase} da quriladi. Faza 0 — shell, layout va dizayn-tizimi tayyor.
        </p>
      </div>
    </div>
  );
}
