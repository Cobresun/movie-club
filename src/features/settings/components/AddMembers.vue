<template>
  <div class="p-4">
    <div class="mb-4 flex items-center">
      <h2 class="text-2xl font-semibold">Add Members</h2>
      <v-btn class="ml-auto" @click="emails.push('')">
        Add email
        <mdicon name="plus" />
      </v-btn>
    </div>
    <div class="flex flex-col gap-2">
      <div
        v-for="(email, index) in emails"
        :key="index"
        class="items-center gap-2"
      >
        <input
          v-model="emails[index]"
          type="email"
          placeholder="Email address"
          class="w-full max-w-md rounded-md border-2 border-gray-300 p-2 text-black outline-none focus:border-primary"
          :class="{ 'border-red-500': showErrors && !isEmailValid(email) }"
        />
        <v-btn class="mx-4 mb-2 align-middle" @click="emails.splice(index, 1)">
          <mdicon name="minus" />
        </v-btn>
      </div>
    </div>
    <v-btn v-if="canSubmit" class="mt-4" @click="submit"> Add members </v-btn>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from "vue";
import { useToast } from "vue-toastification";

import { isDefined } from "../../../../lib/checks/checks.js";

import { useAddMembers } from "@/service/useClub";

const props = defineProps<{
  clubId: string;
}>();

const emit = defineEmits(["close", "success"]);
const toast = useToast();

const emails = ref<string[]>([]);
const showErrors = ref(false);

const isEmailValid = (email: string) => {
  if (!email) return true;
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

const hasInvalidEmails = computed(() =>
  emails.value.some((email) => isDefined(email) && !isEmailValid(email)),
);

const canSubmit = computed(
  () => emails.value.some((email) => email) && !hasInvalidEmails.value,
);

const { mutate: addMembers } = useAddMembers(props.clubId);

const submit = () => {
  showErrors.value = true;
  if (!canSubmit.value) return;

  const validEmails = emails.value.filter((email) => email);
  addMembers(validEmails, {
    onSuccess: () => {
      toast.success("Members added successfully!");
      emails.value = [];
      showErrors.value = false;
      emit("success");
      emit("close");
    },
    onError: (error: unknown) => {
      if (error instanceof Error) {
        const apiError = error as { response?: { data?: string } };
        toast.error(apiError.response?.data ?? error.message);
      } else {
        toast.error("Failed to add members. Please try again.");
      }
      console.error(error);
    },
  });
};
</script>
