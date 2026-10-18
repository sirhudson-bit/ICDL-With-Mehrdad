"use client";

import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import {
  SortableContext,
  arrayMove,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import {
  createBlockAction,
  deleteBlockAction,
  duplicateBlockAction,
  reorderBlocksAction,
  toggleBlockVisibilityAction,
  updateBlockAction,
} from "@/app/actions/admin";
import { FieldEditor } from "@/components/admin/field-editor";
import { getIcon } from "@/components/icon";
import { Badge, Button, ButtonLink } from "@/components/ui/primitives";
import { useToast } from "@/components/ui/toaster";
import {
  BLOCK_CATEGORY_LABELS,
  BLOCK_LIBRARY,
  createBlockData,
  type BlockCategory,
} from "@/lib/content/block-library";
import { BLOCK_FIELDS } from "@/lib/content/block-fields";
import type { BlockType } from "@/lib/content/blocks";
import { toPersianDigits } from "@/lib/persian";
import { cn } from "@/lib/utils";

export type BuilderBlock = {
  id: string;
  type: string;
  order: number;
  isVisible: boolean;
  data: Record<string, unknown>;
};

/**
 * Visual lesson builder.
 *
 * Blocks are dragged to reorder, edited through generated forms, and can be
 * duplicated, hidden or removed — all without touching JSON or code. Reordering
 * is optimistic locally and then persisted, so dragging feels immediate.
 */
export function LessonBuilder({
  lessonId,
  initialBlocks,
  previewHref,
}: {
  lessonId: string;
  initialBlocks: BuilderBlock[];
  previewHref: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [blocks, setBlocks] = useState(initialBlocks);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<Record<string, Record<string, unknown>>>({});
  const [showPalette, setShowPalette] = useState(initialBlocks.length === 0);
  const [pending, startTransition] = useTransition();

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const categories = [...new Set(BLOCK_LIBRARY.map((entry) => entry.category))] as BlockCategory[];

  const onDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const oldIndex = blocks.findIndex((block) => block.id === active.id);
    const newIndex = blocks.findIndex((block) => block.id === over.id);
    if (oldIndex === -1 || newIndex === -1) return;

    const reordered = arrayMove(blocks, oldIndex, newIndex);
    setBlocks(reordered);

    startTransition(async () => {
      const outcome = await reorderBlocksAction(
        lessonId,
        reordered.map((block) => block.id),
      );
      if (!outcome.ok) {
        // Roll back so the UI never disagrees with the database.
        setBlocks(blocks);
        toast({ title: "ترتیب ذخیره نشد", description: outcome.message, tone: "error" });
        return;
      }
      router.refresh();
    });
  };

  const addBlock = (type: BlockType) => {
    startTransition(async () => {
      const outcome = await createBlockAction(lessonId, type, createBlockData(type));
      if (!outcome.ok) {
        toast({ title: "بلوک اضافه نشد", description: outcome.message, tone: "error" });
        return;
      }
      toast({ title: "بلوک اضافه شد", tone: "success", durationMs: 2200 });
      setShowPalette(false);
      router.refresh();
    });
  };

  const runAction = (action: () => Promise<{ ok: boolean; message?: string }>, successTitle: string) => {
    startTransition(async () => {
      const outcome = await action();
      if (!outcome.ok) {
        toast({ title: "انجام نشد", description: outcome.message, tone: "error" });
        return;
      }
      toast({ title: outcome.message ?? successTitle, tone: "success", durationMs: 2400 });
      router.refresh();
    });
  };

  const PlusIcon = getIcon("Plus");
  const LayoutIcon = getIcon("LayoutDashboard");

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-base font-bold">
            <LayoutIcon size={18} aria-hidden="true" />
            سازنده محتوا
          </h2>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {toPersianDigits(blocks.length)} بلوک • با کشیدن دسته کنار هر بلوک، ترتیب را تغییر دهید.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <ButtonLink href={previewHref} variant="outline" size="sm" target="_blank">
            پیش‌نمایش درس
          </ButtonLink>
          <Button size="sm" onClick={() => setShowPalette((current) => !current)} variant={showPalette ? "secondary" : "primary"}>
            <PlusIcon size={15} aria-hidden="true" />
            افزودن بلوک
          </Button>
        </div>
      </header>

      {showPalette ? (
        <div className="rounded-2xl border border-border bg-card-muted p-4">
          <p className="mb-3 text-sm font-bold">چه چیزی به درس اضافه شود؟</p>
          <div className="space-y-4">
            {categories.map((category) => (
              <div key={category}>
                <p className="mb-2 text-xs font-bold text-muted-foreground">{BLOCK_CATEGORY_LABELS[category]}</p>
                <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                  {BLOCK_LIBRARY.filter((entry) => entry.category === category).map((entry) => {
                    const Icon = getIcon(entry.icon);
                    return (
                      <button
                        key={entry.type}
                        type="button"
                        disabled={pending}
                        onClick={() => addBlock(entry.type)}
                        className="flex items-start gap-2.5 rounded-xl border border-border bg-card p-3 text-start transition-colors hover:border-primary/40 disabled:opacity-50"
                      >
                        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
                          <Icon size={15} aria-hidden="true" />
                        </span>
                        <span className="min-w-0">
                          <span className="block text-xs font-bold">{entry.label}</span>
                          <span className="mt-0.5 block text-[0.6875rem] leading-relaxed text-muted-foreground">
                            {entry.description}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : null}

      {blocks.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-border-strong bg-card px-4 py-10 text-center text-sm text-muted-foreground">
          این درس هنوز محتوایی ندارد. با دکمه «افزودن بلوک» شروع کنید.
        </p>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={blocks.map((block) => block.id)} strategy={verticalListSortingStrategy}>
            <ol className="flex flex-col gap-2">
              {blocks.map((block, index) => (
                <SortableBlock
                  key={block.id}
                  block={block}
                  index={index}
                  isEditing={editingId === block.id}
                  draft={drafts[block.id]}
                  pending={pending}
                  onToggleEdit={() => {
                    setEditingId((current) => (current === block.id ? null : block.id));
                    setDrafts((current) => ({ ...current, [block.id]: { ...block.data } }));
                  }}
                  onDraftChange={(next) => setDrafts((current) => ({ ...current, [block.id]: next }))}
                  onSave={(next) =>
                    runAction(async () => {
                      const outcome = await updateBlockAction(block.id, next);
                      if (outcome.ok) setEditingId(null);
                      return outcome;
                    }, "بلوک ذخیره شد")
                  }
                  onDuplicate={() => runAction(() => duplicateBlockAction(block.id), "نسخه کپی ساخته شد")}
                  onToggleVisibility={() =>
                    runAction(() => toggleBlockVisibilityAction(block.id), "وضعیت نمایش تغییر کرد")
                  }
                  onDelete={() => runAction(() => deleteBlockAction(block.id), "بلوک حذف شد")}
                />
              ))}
            </ol>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
}

function SortableBlock({
  block,
  index,
  isEditing,
  draft,
  pending,
  onToggleEdit,
  onDraftChange,
  onSave,
  onDuplicate,
  onToggleVisibility,
  onDelete,
}: {
  block: BuilderBlock;
  index: number;
  isEditing: boolean;
  draft?: Record<string, unknown>;
  pending: boolean;
  onToggleEdit: () => void;
  onDraftChange: (next: Record<string, unknown>) => void;
  onSave: (next: Record<string, unknown>) => void;
  onDuplicate: () => void;
  onToggleVisibility: () => void;
  onDelete: () => void;
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: block.id });

  const entry = BLOCK_LIBRARY.find((item) => item.type === block.type);
  const Icon = getIcon(entry?.icon ?? "Minus");
  const fields = BLOCK_FIELDS[block.type as BlockType] ?? [];

  const current = draft ?? block.data;

  const GripIcon = getIcon("MoveVertical");
  const EditIcon = getIcon("Pencil");
  const CopyIcon = getIcon("Copy");
  const EyeIcon = getIcon(block.isVisible ? "Eye" : "EyeOff");
  const TrashIcon = getIcon("Trash2");

  return (
    <li
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        "rounded-2xl border bg-card",
        isEditing ? "border-primary/40 shadow-[var(--shadow-card)]" : "border-border",
        isDragging && "z-10 opacity-90 shadow-[var(--shadow-raised)]",
        !block.isVisible && "opacity-60",
      )}
    >
      <div className="flex items-center gap-2 p-3">
        <button
          type="button"
          {...attributes}
          {...listeners}
          aria-label={`جابه‌جایی ${entry?.label ?? block.type}`}
          className="inline-flex size-8 shrink-0 cursor-grab items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground active:cursor-grabbing"
        >
          <GripIcon size={16} aria-hidden="true" />
        </button>

        <span className="inline-flex size-7 shrink-0 items-center justify-center rounded-lg bg-muted text-[0.6875rem] font-bold text-muted-foreground">
          {toPersianDigits(index + 1)}
        </span>

        <span className="inline-flex size-8 shrink-0 items-center justify-center rounded-lg bg-primary-soft text-primary">
          <Icon size={15} aria-hidden="true" />
        </span>

        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium">{entry?.label ?? block.type}</span>
          <span className="block truncate text-[0.6875rem] text-subtle-foreground">
            {previewText(block)}
          </span>
        </span>

        {!block.isVisible ? (
          <Badge tone="warning" size="sm">
            پنهان
          </Badge>
        ) : null}

        <span className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onToggleEdit}
            aria-expanded={isEditing}
            aria-label="ویرایش بلوک"
            className={cn(
              "inline-flex size-8 items-center justify-center rounded-lg transition-colors",
              isEditing ? "bg-primary-soft text-primary" : "text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            <EditIcon size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDuplicate}
            disabled={pending}
            aria-label="کپی بلوک"
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <CopyIcon size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onToggleVisibility}
            disabled={pending}
            aria-label={block.isVisible ? "پنهان کردن بلوک" : "نمایش بلوک"}
            className="inline-flex size-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-50"
          >
            <EyeIcon size={15} aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={pending}
            aria-label="حذف بلوک"
            className="inline-flex size-8 items-center justify-center rounded-lg text-danger transition-colors hover:bg-danger-soft disabled:opacity-50"
          >
            <TrashIcon size={15} aria-hidden="true" />
          </button>
        </span>
      </div>

      {isEditing ? (
        <div className="border-t border-border p-4">
          <FieldEditor fields={fields} value={current} onChange={onDraftChange} />

          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-border pt-3">
            <Button size="sm" onClick={() => onSave(current)} disabled={pending}>
              {pending ? "در حال ذخیره…" : "ذخیره بلوک"}
            </Button>
            <Button size="sm" variant="ghost" onClick={onToggleEdit} disabled={pending}>
              انصراف
            </Button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/** Short human-readable summary shown in the collapsed block row. */
function previewText(block: BuilderBlock): string {
  const data = block.data as Record<string, unknown>;
  const candidate =
    (typeof data.title === "string" && data.title) ||
    (typeof data.text === "string" && data.text) ||
    (typeof data.term === "string" && data.term) ||
    (typeof data.code === "string" && data.code) ||
    (typeof data.url === "string" && data.url) ||
    "";

  if (candidate) return candidate.slice(0, 90);

  const html = typeof data.html === "string" ? data.html.replace(/<[^>]+>/g, " ") : "";
  if (html.trim()) return html.trim().slice(0, 90);

  if (Array.isArray(data.items)) return `${toPersianDigits(data.items.length)} مورد`;
  if (Array.isArray(data.steps)) return `${toPersianDigits(data.steps.length)} مرحله`;
  if (Array.isArray(data.rows)) return `${toPersianDigits(data.rows.length)} سطر`;
  if (data.exercise) return "تمرین تعاملی";
  if (data.demo) return "نمایش تعاملی";

  return "بدون پیش‌نمایش";
}
