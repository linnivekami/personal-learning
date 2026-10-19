import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { GrowthPage as GrowthView } from "./GrowthView";

export function GrowthPage() {
  const { tr } = useI18n();
  const L = useLearning();
  return (
    <GrowthView
      rewards={L.rewards}
      refresh={L.refresh}
      onError={L.notify}
      tr={tr}
      user={L.user}
    />
  );
}
