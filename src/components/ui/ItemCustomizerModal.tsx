"use client";

import { Button } from "@/components/ui/Button";
import { Modal, ModalPanel } from "@/components/ui/Modal";

type ItemCustomizerModalProps = {
  isOpen: boolean;
  productName: string;
  options: readonly string[];
  requiredCount: number;
  selectedOptions: string[];
  note: string;
  onToggleOption: (option: string) => void;
  onNoteChange: (value: string) => void;
  onConfirm: () => void;
  onClose: () => void;
};

export function ItemCustomizerModal({
  isOpen,
  productName,
  options,
  requiredCount,
  selectedOptions,
  note,
  onToggleOption,
  onNoteChange,
  onConfirm,
  onClose,
}: ItemCustomizerModalProps) {
  if (!isOpen) {
    return null;
  }

  const reachedLimit = selectedOptions.length >= requiredCount;
  const canSubmit = selectedOptions.length === requiredCount;

  return (
    <Modal onClose={onClose}>
      <ModalPanel className="max-w-xl space-y-5 border-cta/40 bg-surface-2">
        <div>
          <p className="text-sm font-semibold uppercase tracking-wide text-muted">
            Personaliza tu producto
          </p>
          <h2 className="text-2xl font-bold text-ink">{productName}</h2>
          <p className="mt-1 text-sm text-muted">
            Selecciona {requiredCount} de {options.length}
          </p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          {options.map((option) => {
            const isSelected = selectedOptions.includes(option);
            const shouldDisable = !isSelected && reachedLimit;

            return (
              <Button
                key={option}
                size="lg"
                type="button"
                variant={isSelected ? "primary" : "secondary"}
                onClick={() => onToggleOption(option)}
                disabled={shouldDisable}
                aria-pressed={isSelected}
              >
                {option}
              </Button>
            );
          })}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted">Notas (opcional)</p>
          <textarea
            className="min-h-24 w-full rounded-2xl border border-border bg-surface px-4 py-3 text-base text-ink placeholder:text-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cta/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background"
            placeholder="Ej. sin cebolla, sin jitomate"
            value={note}
            onChange={(event) => onNoteChange(event.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-3">
          <Button size="lg" type="button" onClick={onConfirm} disabled={!canSubmit}>
            Agregar al carrito
          </Button>
          <Button size="lg" variant="secondary" type="button" onClick={onClose}>
            Cancelar
          </Button>
        </div>
      </ModalPanel>
    </Modal>
  );
}
