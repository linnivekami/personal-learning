import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { AdminPage as AdminView } from "./AdminView";

export function AdminPage() {
  const { tr } = useI18n();
  const L = useLearning();
  return <AdminView tr={tr} onError={L.notify} />;
}
