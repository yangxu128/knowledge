import useSWR, { SWRConfiguration } from 'swr';

export const fetcher = (url: string) => fetch(url).then(r => {
  if (!r.ok) throw new Error(`HTTP ${r.status}`);
  return r.json();
});

export function useApi<T = unknown>(url: string | null, options?: SWRConfiguration) {
  return useSWR<T>(url, fetcher, {
    revalidateOnFocus: false,
    dedupingInterval: 10000,
    ...options,
  });
}
