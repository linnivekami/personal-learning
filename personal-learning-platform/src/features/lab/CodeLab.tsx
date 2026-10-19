import { useState } from "react";
import { Code2 } from "lucide-react";
import { CodeRunner } from "./CodeRunner";
type Tr = (a: string, b: string) => string;
export function CodeLab({
  tr,
  onError,
  sandboxOrigin,
}: {
  tr: Tr;
  onError: (s: string) => void;
  sandboxOrigin: string | null;
}) {
  const [language, setLanguage] = useState<"python" | "sql">("python");
  return (
    <>
      <div className="segmented">
        <button
          className={language === "python" ? "active" : ""}
          onClick={() => setLanguage("python")}
        >
          Python
        </button>
        <button
          className={language === "sql" ? "active" : ""}
          onClick={() => setLanguage("sql")}
        >
          SQL
        </button>
      </div>
      <div className="lab-context">
        <Code2 size={21} />
        <p>
          {tr(
            "Python 支持 NumPy、pandas 和 Matplotlib。SQL 使用内存 SQLite。只会向运行区传入你选中的练习数据。",
            "Python supports NumPy, pandas and Matplotlib. SQL uses in-memory SQLite. Only selected exercise data is sent to the runtime.",
          )}
        </p>
      </div>
      <CodeRunner
        key={language}
        language={language}
        starter={
          language === "python"
            ? 'import pandas as pd\n\ndata = pd.DataFrame({\n    "week": [1, 2, 3, 4],\n    "questions": [3, 5, 4, 8],\n})\nprint(data)\nprint("Mean:", data["questions"].mean())'
            : "CREATE TABLE practice (week INTEGER, questions INTEGER);\nINSERT INTO practice VALUES (1,3),(2,5),(3,4),(4,8);\nSELECT AVG(questions) AS mean_questions FROM practice;"
        }
        onError={onError}
        sandboxOrigin={sandboxOrigin}
        tr={tr}
      />
    </>
  );
}
