import { ref } from 'vue';

type PaginationStateOptions = {
  initialPage?: number;
  initialPageSize?: number;
};

export function useServerPagination(options: PaginationStateOptions = {}) {
  const page = ref(options.initialPage ?? 1);
  const pageSize = ref(options.initialPageSize ?? 10);
  const total = ref(0);

  const resetPage = () => {
    page.value = 1;
  };

  const updateTotal = (value: number) => {
    total.value = Number.isFinite(value) ? value : 0;
  };

  const applyPagedResult = <T>(result: any, list: { value: T[] }) => {
    list.value = Array.isArray(result?.items) ? result.items : [];
    updateTotal(result?.total || 0);
  };

  return {
    page,
    pageSize,
    total,
    resetPage,
    updateTotal,
    applyPagedResult,
  };
}