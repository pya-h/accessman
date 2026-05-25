import { useState, useEffect, useCallback, useRef } from 'preact/hooks';

interface QueryResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useQuery<T>(fetcher: () => Promise<T>, deps: unknown[]): QueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const version = useRef(0);

  const execute = useCallback(() => {
    const v = ++version.current;
    setLoading(true);
    setError(null);

    fetcher()
      .then((result) => {
        if (v === version.current) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err) => {
        if (v === version.current) {
          setError(err?.message || 'Request failed');
          setLoading(false);
        }
      });
  }, deps);

  useEffect(() => {
    execute();
  }, [execute]);

  useEffect(() => {
    return () => { version.current++; };
  }, []);

  return { data, loading, error, refetch: execute };
}
