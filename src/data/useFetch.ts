import { FetchConfig } from "@/models";
import axios, { AxiosError, AxiosResponse } from "axios";
import { computed, reactive, ref } from "vue";

export const useFetch = <T>(url: string, config: FetchConfig = {}) => {
  const data = ref<T>();
  const response = ref<AxiosResponse<T>>();
  const error = ref<AxiosError | unknown>();
  const loading = ref(false);

  const fetch = async () => {
    loading.value = true;
    try {
      const result = await axios.request<T>({
        url,
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

  return { data, response, error, loading, fetch }
}

const cacheMap = reactive(new Map());

export const useFetchCache = <T>(key: string, url: string, config: FetchConfig = {}) => {
  const info = useFetch<T>(url, { ...config, skip: true });

  const update = () => cacheMap.set(key, info.response.value);
  const clear = () => cacheMap.set(key, undefined);

  const fetch = async () => {
    try {
      await info.fetch();
      update();
    } catch {
      clear();
    }
  }

  const response = computed<AxiosResponse<T>>(() => cacheMap.get(key));
  const data = computed<T>(() => response.value?.data);

  if (response.value == null) fetch();

  return { ...info, fetch, data, response, clear };
}