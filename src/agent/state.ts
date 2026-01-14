import { Annotation, MessagesAnnotation } from "@langchain/langgraph";
import { BaseMessage } from "@langchain/core/messages";

export const AgentState = Annotation.Root({
  ...MessagesAnnotation.spec,
  next: Annotation<string>({
    reducer: (x, y) => y ?? x,
    default: () => "supervisor",
  }),
});
