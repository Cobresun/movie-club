<template>
  <v-modal size="sm" @close="handleClose">
    <h2 class="mb-6 text-2xl font-bold text-text">
      {{ isSignUp ? "Sign Up" : "Sign In" }}
    </h2>

    <!-- Tab Switcher -->
    <div class="mb-6 flex border-b border-gray-600">
      <button
        :class="[
          'flex-1 pb-3 font-medium transition-colors',
          !isSignUp
            ? 'border-b-2 border-primary text-primary'
            : 'text-gray-400 hover:text-gray-300',
        ]"
        @click="isSignUp = false"
      >
        Sign In
      </button>
      <button
        :class="[
          'flex-1 pb-3 font-medium transition-colors',
          isSignUp
            ? 'border-b-2 border-primary text-primary'
            : 'text-gray-400 hover:text-gray-300',
        ]"
        @click="isSignUp = true"
      >
        Sign Up
      </button>
    </div>

    <!-- Error Message -->
    <div
      v-if="errorMessage"
      class="mb-4 rounded bg-red-900/50 p-3 text-sm text-red-300"
    >
      {{ errorMessage }}
    </div>

    <!-- Form -->
    <form class="space-y-4" @submit.prevent="handleSubmit">
      <!-- Name (Sign Up only) -->
      <div v-if="isSignUp">
        <label for="name" class="mb-1 block text-sm font-medium text-gray-300"
          >Name</label
        >
        <input
          id="name"
          v-model="name"
          type="text"
          required
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Your name"
        />
      </div>

      <!-- Email -->
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-gray-300"
          >Email</label
        >
        <input
          id="email"
          v-model="email"
          type="email"
          required
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="your@email.com"
        />
      </div>

      <!-- Password -->
      <div>
        <label
          for="password"
          class="mb-1 block text-sm font-medium text-gray-300"
          >Password</label
        >
        <input
          id="password"
          v-model="password"
          type="password"
          required
          minlength="8"
          class="w-full rounded border border-gray-600 bg-gray-700 px-3 py-2 text-white placeholder-gray-400 focus:border-primary focus:outline-none focus:ring-1 focus:ring-primary"
          placeholder="Min 8 characters"
        />
      </div>

      <!-- Submit Button -->
      <button
        type="submit"
        :disabled="loading"
        class="w-full rounded bg-primary px-4 py-2 font-medium text-text transition-all hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {{ loading ? "Loading..." : isSignUp ? "Sign Up" : "Sign In" }}
      </button>
    </form>
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
