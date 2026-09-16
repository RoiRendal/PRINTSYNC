const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '/api/v1';

/**
 * CSV downloads.
 *
 * These bypass the shared `apiClient` deliberately: that client parses JSON
 * responses, whereas an export returns a binary blob whose filename arrives in a
 * `content-disposition` header. The base URL and `credentials: 'include'` are the
 * same, so the auth behaviour is identical — which is why the unused `client`
 * parameter that used to be threaded through here has been dropped.
 */
export const exportApi = {
  downloadOrders: () => downloadCsv(`${API_BASE_URL}/export/orders`, 'orders'),
  downloadInventory: () => downloadCsv(`${API_BASE_URL}/export/inventory`, 'inventory'),
  downloadTransactions: () => downloadCsv(`${API_BASE_URL}/export/transactions`, 'transactions'),
};

async function downloadCsv(url: string, prefix: string) {
  const response = await fetch(url, {
    method: 'GET',
    headers: { Accept: 'text/csv' },
    credentials: 'include',
  });
  if (!response.ok) {
    const body = await response.text().catch(() => 'Export failed.');
    throw new Error(body || `Export failed with status ${response.status}`);
  }
  const blob = await response.blob();
  const filename = response.headers.get('content-disposition')?.match(/filename="([^"]+)"/)?.[1] ?? `${prefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  const objectUrl = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = objectUrl;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
  URL.revokeObjectURL(objectUrl);
}
