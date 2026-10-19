import { useEffect, useState } from "react";
import type { Note } from "../../../shared/types";
import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { api } from "../../lib/api";
import { NotesPage as NotesView } from "./NotesView";

export function NotesPage() {
  const { tr } = useI18n();
  const L = useLearning();
  const [notes, setNotes] = useState<Note[]>([]);
  const own = !!L.user && !L.sample;
  useEffect(() => {
    if (!own) return setNotes([]);
    void api<{ notes: Note[] }>(`/courses/${L.course.id}/notes`)
      .then((d) => setNotes(d.notes))
      .catch((e: Error) => L.notify(e.message));
  }, [L.course.id, own]);
  return (
    <NotesView
      key={L.course.id}
      course={L.course}
      notes={notes}
      setNotes={setNotes}
      requireLogin={L.requireCourse}
      onError={L.notify}
      tr={tr}
    />
  );
}
