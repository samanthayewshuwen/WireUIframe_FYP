import toast from "react-hot-toast";
import classNames from "classnames";

import { Badge } from "../ui/badge";
import { renderHistory } from "./utils";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "../ui/collapsible";
import { Button } from "../ui/button";
import { CaretSortIcon } from "@radix-ui/react-icons";
import { useProjectStore } from "../../store/project-store";

interface Props {
  shouldDisableReverts: boolean;
}

export default function HistoryDisplay({ shouldDisableReverts }: Props) {
  const { commits, head, setHead, removeCommit } = useProjectStore();

  // Put all commits into an array and sort by created date (oldest first)
  const flatHistory = Object.values(commits).sort(
    (a, b) =>
      new Date(a.dateCreated).getTime() - new Date(b.dateCreated).getTime()
  );

  // Annotate history items with a summary, parent version, etc.
  const renderedHistory = renderHistory(flatHistory);

  const handleDelete = (hash: string, index: number) => {
    // If deleting the current head, move to the nearest other version.
    if (hash === head) {
      const adjacent = renderedHistory.find((_, i) => i !== index);
      if (adjacent) setHead(adjacent.hash);
    }
    removeCommit(hash);
    toast.success("Version deleted");
  };

  return renderedHistory.length === 0 ? null : (
    <div className="flex flex-col h-screen">
      <h1 className="font-bold mb-2">Versions</h1>
      <ul className="space-y-0 flex flex-col-reverse">
        {renderedHistory.map((item, index) => (
          <li key={index}>
            <Collapsible>
              <div
                className={classNames(
                  "flex items-center justify-between space-x-2 w-full pr-2",
                  "border-b cursor-pointer",
                  {
                    " hover:bg-black hover:text-white": item.hash === head,
                    "bg-slate-500 text-white": item.hash === head,
                  }
                )}
              >
                <div
                  className="flex justify-between truncate flex-1 p-2"
                  onClick={() => {
                    if (item.hash === head) return;
                    if (shouldDisableReverts) {
                      toast.error("Exit Interactive Edit mode first before switching versions.");
                      return;
                    }
                    setHead(item.hash);
                  }}
                >
                  <div className="flex gap-x-1 truncate">
                    <h2 className="text-sm truncate">{item.summary}</h2>
                    {item.parentVersion !== null && (
                      <h2 className="text-sm">
                        (parent: v{item.parentVersion})
                      </h2>
                    )}
                  </div>
                  <h2 className="text-sm">v{index + 1}</h2>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDelete(item.hash, index);
                  }}
                  className="h-5 w-5 flex-shrink-0 flex items-center justify-center rounded text-xs text-red-400 hover:bg-red-100 hover:text-red-600 dark:hover:bg-red-900/40 transition-colors"
                  title="Delete this version"
                >
                  ×
                </button>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6">
                    <CaretSortIcon className="h-4 w-4" />
                    <span className="sr-only">Toggle</span>
                  </Button>
                </CollapsibleTrigger>
              </div>
              <CollapsibleContent className="w-full bg-slate-300 p-2">
                <div>Full prompt: {item.summary}</div>
                <div className="flex justify-end">
                  <Badge>{item.type}</Badge>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </li>
        ))}
      </ul>
    </div>
  );
}
