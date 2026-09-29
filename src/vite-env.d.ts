/// <reference types="vite/client" />

// Midtrans Snap.js global injected via CDN script tag
interface MidtransSnapCallbacks {
  onSuccess?: (result: { order_id: string; transaction_id: string }) => void;
  onPending?: (result: { order_id: string }) => void;
  onError?: (result: { status_message: string }) => void;
  onClose?: () => void;
}

interface Window {
  snap?: {
    pay: (token: string, callbacks?: MidtransSnapCallbacks) => void;
    hide: () => void;
  };
}

