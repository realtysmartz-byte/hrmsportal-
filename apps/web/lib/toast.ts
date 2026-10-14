export type ToastType = "success" | "error";

export interface ToastItem {
  id: number;
  type: ToastType;
  message: string;
}

let items: ToastItem[] = [];
let nextId = 1;
const listeners = new Set<(items: ToastItem[]) => void>();

function emit() {
  listeners.forEach((l) => l(items));
}

export function dismissToast(id: number) {
  items = items.filter((t) => t.id !== id);
  emit();
}

export function toast(type: ToastType, message: string) {
  const id = nextId++;
  items = [...items, { id, type, message }].slice(-4);
  emit();
  setTimeout(() => dismissToast(id), type === "error" ? 5000 : 3500);
}

export function subscribeToasts(listener: (items: ToastItem[]) => void) {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
}
