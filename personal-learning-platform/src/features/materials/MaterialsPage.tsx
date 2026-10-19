import { useEffect, useState } from "react";
import type { Material } from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { api } from "../../lib/api";
import { MaterialsPage as MaterialsView } from "./MaterialsView";

export function MaterialsPage() {
  const { tr } = useI18n();
  const L = useLearning();
  const [materials, setMaterials] = useState<Material[]>([]);
  const own = !!L.user && !L.sample;
  useEffect(() => {
    if (!own) return setMaterials([]);
    void api<{ materials: Material[] }>(`/courses/${L.course.id}/materials`)
      .then((d) => setMaterials(d.materials))
      .catch((e: Error) => L.notify(e.message));
  }, [L.course.id, own]);
  // Poll while a file is still being parsed.
  useEffect(() => {
    if (
      !own ||
      !materials.some((m) =>
        ["uploaded", "processing", "partial"].includes(m.status),
      )
    )
      return;
    const timer = setInterval(
      () =>
        void api<{ materials: Material[] }>(`/courses/${L.course.id}/materials`)
          .then((d) => setMaterials(d.materials))
          .catch(() => {}),
      6000,
    );
    return () => clearInterval(timer);
  }, [own, materials, L.course.id]);
  return (
    <MaterialsView
      course={L.course}
      materials={materials}
      setMaterials={setMaterials}
      requireLogin={L.requireCourse}
      onError={L.notify}
      onOrganized={L.updateCourse}
      tr={tr}
    />
  );
}
