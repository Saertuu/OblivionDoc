export const CATEGORIES = [
  "Приказы",
  "Учебные материалы",
  "Договоры",
  "Отчёты",
  "Локальные акты",
] as const;
export const DEPARTMENTS = [
  "Учебный отдел",
  "Администрация",
  "Бухгалтерия",
  "Методический отдел",
] as const;
export const ROLES = {
  archivist: "Архивариус",
  reader: "Наблюдатель",
  admin: "Администратор",
} as const;
export type Role = keyof typeof ROLES;
export type View =
  | "documents"
  | "folders"
  | "retention"
  | "activity"
  | "settings";
export type Category = (typeof CATEGORIES)[number];
export type ArchiveDocument = {
  id: string;
  title: string;
  number: string;
  category: Category;
  department: string;
  author: string;
  documentDate: string;
  retainUntil: string | null;
  visibility: "all" | "staff";
  status: "active" | "archived";
  fileName: string;
  mimeType: string;
  size: number;
  createdAt: string;
  updatedAt: string;
  example?: boolean;
};
export type DocumentInput = Pick<
  ArchiveDocument,
  | "title"
  | "number"
  | "category"
  | "department"
  | "author"
  | "documentDate"
  | "retainUntil"
  | "visibility"
>;
export type AuditAction =
  | "created"
  | "updated"
  | "archived"
  | "restored"
  | "deleted"
  | "downloaded"
  | "viewed"
  | "exported";
export type AuditEvent = {
  id?: number;
  action: AuditAction;
  title: string;
  actor: string;
  at: string;
};
export type Snapshot = { documents: ArchiveDocument[]; events: AuditEvent[] };
export const ACTIONS: Record<AuditAction, string> = {
  created: "Добавлен документ",
  updated: "Изменена карточка",
  archived: "Перенесён в архив",
  restored: "Возвращён в работу",
  deleted: "Удалён документ",
  downloaded: "Скачан файл",
  viewed: "Открыт документ",
  exported: "Выгружен реестр",
};
export const canEdit = (role: Role) => role !== "reader";
export const visibleTo = (document: ArchiveDocument, role: Role) =>
  role !== "reader" || document.visibility === "all";
