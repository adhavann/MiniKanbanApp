import { useState, useEffect, useCallback } from 'react';

interface UseAlertOptions {
  timeout?: number;
  onClose?: () => void;
}

export const useAlert = (initialMessage: string = '', options: UseAlertOptions = {}) => {
  const [message, setMessage] = useState(initialMessage);
  const [severity, setSeverity] = useState<'success' | 'info' | 'warning' | 'error'>('error');
  const { timeout = 5000, onClose } = options;

  const showAlert = useCallback((msg: string, alertSeverity: 'success' | 'info' | 'warning' | 'error' = 'error') => {
    setMessage(msg);
    setSeverity(alertSeverity);
  }, []);

  const hideAlert = useCallback(() => {
    setMessage('');
    onClose?.();
  }, [onClose]);

  // Auto-dismiss after timeout
  useEffect(() => {
    if (message && timeout > 0) {
      const timer = setTimeout(() => {
        hideAlert();
      }, timeout);

      return () => clearTimeout(timer);
    }
  }, [message, timeout, hideAlert]);

  return {
    message,
    severity,
    showAlert,
    hideAlert,
    hasMessage: message.length > 0,
  };
};
