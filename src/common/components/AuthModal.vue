<template>
  <v-modal @close="handleClose">
    <div class="w-full max-w-md rounded-lg bg-white p-6 shadow-xl">
      <h2 class="mb-6 text-2xl font-bold text-gray-900">
        {{ isSignUp ? "Sign Up" : "Sign In" }}
      </h2>

      <!-- Tab Switcher -->
      <div class="mb-6 flex gap-2">
        <button
          :class="[
            'flex-1 rounded px-4 py-2 font-medium transition-colors',
            !isSignUp
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          ]"
          @click="isSignUp = false"
        >
          Sign In
        </button>
        <button
          :class="[
            'flex-1 rounded px-4 py-2 font-medium transition-colors',
            isSignUp
              ? 'bg-blue-600 text-white'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200',
          ]"
          @click="isSignUp = true"
        >
          Sign Up
        </button>
      </div>

      <!-- Error Message -->
      <div
        v-if="errorMessage"
        class="mb-4 rounded bg-red-50 p-3 text-sm text-red-600"
      >
        {{ errorMessage }}
      </div>

      <!-- Form -->
      <form class="space-y-4" @submit.prevent="handleSubmit">
        <!-- Name (Sign Up only) -->
        <div v-if="isSignUp">
          <label for="name" class="mb-1 block text-sm font-medium text-gray-700"
            >Name</label
          >
          <input
            id="name"
            v-model="name"
            type="text"
            required
            class="w-full rounded border border-gray-300 px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Your name"
          />
        </div>

        <!-- Email -->
        <div>
          <label
            for="email"
            class="mb-1 block text-sm font-medium text-gray-700"
            >Email</label
          >
          <input
            id="email"
            v-model="email"
            type="email"
            required
            class="w-full rounded border border-gray-300 px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="your@email.com"
          />
        </div>

        <!-- Password -->
        <div>
          <label
            for="password"
            class="mb-1 block text-sm font-medium text-gray-700"
            >Password</label
          >
          <input
            id="password"
            v-model="password"
            type="password"
            required
            minlength="8"
            class="w-full rounded border border-gray-300 px-3 py-2 text-black focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
            placeholder="Min 8 characters"
          />
        </div>

        <!-- Submit Button -->
        <button
          type="submit"
          :disabled="loading"
          class="w-full rounded bg-blue-600 px-4 py-2 font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {{ loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In" }}
        </button>
      </form>
    </div>
  </v-modal>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { useToast } from "vue-toastification";

import { authClient } from "@/lib/auth-client";

const emit = defineEmits<{
  (e: "close"): void;
}>();

const toast = useToast();

const isSignUp = ref(false);
const email = ref("");
const password = ref("");
const name = ref("");
const loading = ref(false);
const errorMessage = ref("");

const handleClose = () => {
  // Reset form
  email.value = "";
  password.value = "";
  name.value = "";
  errorMessage.value = "";
  loading.value = false;
  isSignUp.value = false;
  emit("close");
};

const handleSubmit = async () => {
  errorMessage.value = "";
  loading.value = true;

  try {
    if (isSignUp.value) {
      // Sign Up
      await authClient.signUp.email(
        {
          email: email.value,
          password: password.value,
          name: name.value,
        },
        {
          onSuccess: () => {
            toast.success("Account created successfully!");
            handleClose();
          },
          onError: (ctx) => {
            errorMessage.value = ctx.error.message || "Failed to sign up";
          },
        },
      );
    } else {
      // Sign In
      await authClient.signIn.email(
        {
          email: email.value,
          password: password.value,
        },
        {
          onSuccess: () => {
            toast.success("Signed in successfully!");
            handleClose();
          },
          onError: (ctx) => {
            errorMessage.value = ctx.error.message || "Failed to sign in";
          },
        },
      );
    }
  } finally {
    loading.value = false;
  }
};
</script>
