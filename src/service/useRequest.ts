import axios, { AxiosError, AxiosResponse } from "axios";
import { computed, reactive, ref } from "vue";

import { DataService, FetchConfig } from "@/common/types/models";
import { useAuthStore } from "@/stores/auth";

export const useRequest = <T>(
  urlInp?: string,
  configInp: FetchConfig = {}
): DataService<T> => {
  const data = ref<T>();
  const response = ref<AxiosResponse<T>>();
  const error = ref<AxiosError | unknown>();
  const loading = ref(false);

  const execute = async (url?: string, config?: FetchConfig) => {
    loading.value = true;
    try {
      const result = await axios.request<T>({
        url: url ?? urlInp,
        ...configInp,
        ...config,
      });
      response.value = result;
      data.value = result.data;
    } catch (ex) {
      error.value = ex;
    } finally {
      loading.value = false;
    }
  };

  !configInp.skip && urlInp && execute();

  return { data, response, error, loading, execute };
};

const cacheMap = reactive(new Map());

export const useRequestCache = <T>(
  keyInp: string,
  url?: string,
  config: FetchConfig = {}
) => {
  const info = useRequest<T>(url, { ...config, skip: true });
  const loading = ref(false);

  const key = ref(keyInp);

  const updateKey = (value: string) => {
    key.value = value;
  };

  const update = () => cacheMap.set(key.value, info.response.value);
  const clear = () => cacheMap.set(key.value, undefined);

  const response = computed<AxiosResponse<T>>(() => cacheMap.get(key.value));
  const data = computed<T>(() => response.value?.data);

  const execute = async (
    url?: string,
    config?: FetchConfig,
    isRefresh?: boolean
  ) => {
    if (!isRefresh && response.value) return;
    loading.value = !isRefresh;
    try {
      await info.execute(url, config);
      update();
    } catch {
      clear();
    } finally {
      loading.value = false;
    }
  };

  const refresh = async () => {
    await execute(undefined, undefined, true);
  };

  !config.skip && execute();

  return {
    ...info,
    execute,
    data,
    response,
    clear,
    updateKey,
    loading,
    refresh,
  };
};

export const clearCache = () => {
  cacheMap.clear();
};

export const useAuthRequest = <T>(url?: string, config: FetchConfig = {}) => {
  const store = useAuthStore();
  const headers = {
    ...config.headers,
    Authorization: `Bearer ${store.authToken}`,
  };
  const fetch = useRequest<T>(url, { ...config, headers });
  return { ...fetch };
};
