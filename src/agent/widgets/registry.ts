import type { WidgetDef } from "./frame";
// Shared core widgets (owned by the agent-engine maintainer).
import { QuickReplies } from "./core/QuickReplies";
import { Disambiguate } from "./core/Disambiguate";
import { RecipientSet } from "./core/RecipientSet";
import { BulkMessageComposer } from "./core/BulkMessageComposer";
import { DeliveryTracker } from "./core/DeliveryTracker";
import { ReportPreview } from "./core/ReportPreview";
import { AnswerCard } from "./core/AnswerCard";
import { DataTable } from "./core/DataTable";
import { Ledger } from "./core/Ledger";
import { PaymentForm } from "./core/PaymentForm";
import { Receipt } from "./core/Receipt";
import { PlanChecklist } from "./core/PlanChecklist";
import { ProgressList } from "./core/ProgressList";
import { BatchCards } from "./core/BatchCards";
import { Diff } from "./core/Diff";
import { CallHandoff } from "./core/CallHandoff";
import { EntityCard } from "./core/EntityCard";
// Category widgets. Each category agent owns its ext file and widgets/<category>/.
import { widgets as frontdesk } from "./ext/frontdesk";
import { widgets as money } from "./ext/money";
import { widgets as collections } from "./ext/collections";
import { widgets as access } from "./ext/access";
import { widgets as facility } from "./ext/facility";
import { widgets as growth } from "./ext/growth";
import { widgets as comms } from "./ext/comms";
import { widgets as reports } from "./ext/reports";
import { widgets as day } from "./ext/day";
import { widgets as admin } from "./ext/admin";

// Widget type → component. ctx.ask("payment", props) is typed from this map.
export const WIDGETS = {
  quickReplies: QuickReplies, // W1
  disambiguate: Disambiguate, // W2
  recipients: RecipientSet, // W3
  bulkMessage: BulkMessageComposer, // W4
  delivery: DeliveryTracker, // W5
  reportPreview: ReportPreview, // W9
  answer: AnswerCard, // W10
  table: DataTable, // W12
  ledger: Ledger, // W13
  payment: PaymentForm, // W14
  receipt: Receipt, // W15
  plan: PlanChecklist, // W29
  progress: ProgressList, // W30
  batch: BatchCards, // W31
  diff: Diff, // W39
  callHandoff: CallHandoff, // W42
  entity: EntityCard,
  ...frontdesk,
  ...money,
  ...collections,
  ...access,
  ...facility,
  ...growth,
  ...comms,
  ...reports,
  ...day,
  ...admin,
};

export type WidgetMap = typeof WIDGETS;
export type WidgetType = keyof WidgetMap;
export type WidgetProps<K extends WidgetType> = WidgetMap[K] extends WidgetDef<infer P, any> ? P : never;
export type WidgetAnswer<K extends WidgetType> = WidgetMap[K] extends WidgetDef<any, infer A> ? A : never;

export function widgetFor(type: string): WidgetDef<any, any> | undefined {
  return (WIDGETS as Record<string, WidgetDef<any, any>>)[type];
}
