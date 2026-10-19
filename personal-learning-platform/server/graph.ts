import type { Concept } from "../shared/types";
import { ApiError } from "./env";
export function graphCheck(concepts: Concept[]) {
  const ids = new Set(concepts.map((n) => n.id));
  if (ids.size !== concepts.length)
    throw new ApiError(400, "GRAPH_DUPLICATE", "知识点编号重复。");
  const visiting = new Set<string>(),
    done = new Set<string>();
  const visit = (id: string) => {
    if (visiting.has(id))
      throw new ApiError(400, "GRAPH_CYCLE", "先修关系存在循环。");
    if (done.has(id)) return;
    visiting.add(id);
    const n = concepts.find((c) => c.id === id)!;
    for (const p of [...n.prerequisites, ...(n.parentId ? [n.parentId] : [])]) {
      if (!ids.has(p) || p === id)
        throw new ApiError(400, "GRAPH_REFERENCE", "知识图存在无效关联。");
      visit(p);
    }
    visiting.delete(id);
    done.add(id);
  };
  for (const id of ids) visit(id);
}
