export type ToastType = "success" | "error";

export interface ToastItem {
  id: number;
  type: ToastType;
  title?: string;
  message: string;
  quote?: string;
  badge?: string;
  duration?: number;
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

export function toast(
  type: ToastType,
  message: string,
  options?: {
    title?: string;
    quote?: string;
    badge?: string;
    duration?: number;
  }
) {
  const id = nextId++;
  const title = options?.title;
  const quote = options?.quote;
  const badge = options?.badge;
  const duration =
    options?.duration ?? (quote ? 7000 : type === "error" ? 5000 : 3500);

  items = [...items, { id, type, message, title, quote, badge, duration }].slice(-4);
  emit();
  setTimeout(() => dismissToast(id), duration);
}

export function subscribeToasts(listener: (items: ToastItem[]) => void) {
  listeners.add(listener);
  listener(items);
  return () => {
    listeners.delete(listener);
  };
}
