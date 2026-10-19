import { useI18n } from "../../app/i18n";
import { useLearning } from "../../app/store";
import { Page } from "../../ui/primitives";
import { CodeLab } from "./CodeLab";

export function CodeLabPage() {
  const { tr } = useI18n();
  const L = useLearning();
  return (
    <Page
      title={tr("代码实验室", "Code lab")}
      lead={tr(
        "动手验证想法，再把结果连接回原理。代码只在你的浏览器里运行。",
        "Test an idea, then connect the result back to the principle. Code runs only in your browser.",
      )}
    >
      <CodeLab
        tr={tr}
        onError={L.notify}
        sandboxOrigin={L.config?.sandboxOrigin ?? null}
      />
    </Page>
  );
}
