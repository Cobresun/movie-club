import { FetchConfig } from "@/models";
import axios, { AxiosError, AxiosResponse } from "axios";
import { computed, reactive, ref } from "vue";
import { useStore } from "vuex";

export const useFetch = <T>(urlInp: string, config: FetchConfig = {}) => {
  const data = ref<T>();
  const response = ref<AxiosResponse<T>>();
  const error = ref<AxiosError | unknown>();
  const loading = ref(false);

  const url = ref<string>(urlInp);

  const updateUrl = (value: string) => { url.value = value }

  const fetch = async () => {
    loading.value = true;
    try {
      const result = await axios.request<T>({
        url: url.value,
        ...config
      });
      response.value = result;
      data.value = result.data;
    } catch (ex) {
      error.value = ex;
    } finally {
      loading.value = false;
    }
  }

  !config.skip && fetch();

  return { data, response, error, loading, fetch, updateUrl }
}

const cacheMap = reactive(new Map());

export const useFetchCache = <T>(keyInp: string, url: string, config: FetchConfig = {}) => {
  const info = useFetch<T>(url, { ...config, skip: true });
  const loading = ref(false);

  const key = ref(keyInp);

  const updateKey = (value: string) => { key.value = value };

  const update = () => cacheMap.set(key.value, info.response.value);
  const clear = () => cacheMap.set(key.value, undefined);

  const response = computed<AxiosResponse<T>>(() => cacheMap.get(key.value));
  const data = computed<T>(() => response.value?.data);

  const fetch = async (isRefresh?: boolean) => {
    if (!isRefresh && response.value) return;
    loading.value = !isRefresh;
    try {
      await info.fetch();
      update();
    } catch {
      clear();
    } finally {
      loading.value = false;
    }
  }

  const refresh = async () => {
    await fetch(true);
  }

  !config.skip && fetch();

  return { ...info, fetch, data, response, clear, updateKey, loading, refresh };
}

export const clearCache = () => {
  cacheMap.clear();
}

export const useAuthFetch = <T>(key: string, url: string, config: FetchConfig = {}) => {
  const store = useStore();
  const headers = {
    ...config.headers, 
    Authorization: `Bearer ${store.getters['auth/authToken']}`
  };
  const fetch = useFetchCache<T>(key, url, {...config, headers});
  return {...fetch};
}