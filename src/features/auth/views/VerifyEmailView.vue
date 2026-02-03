<template>
  <div class="flex min-h-[60vh] items-center justify-center p-8">
    <div
      class="w-full max-w-md rounded-lg bg-lowBackground p-8 text-center shadow-lg"
    >
      <!-- Loading State -->
      <div v-if="isVerifying" class="space-y-4">
        <loading-spinner />
        <p class="text-lg text-gray-300">Verifying your email...</p>
      </div>

      <!-- Success State -->
      <div v-else-if="isSuccess" class="space-y-4">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-green-900/50"
        >
          <mdicon name="check" size="32" class="text-green-400" />
        </div>
        <h1 class="text-2xl font-bold text-text">Email Verified!</h1>
        <p class="text-gray-300">
          Your email has been verified successfully. You're now signed in.
        </p>
        <v-btn class="mt-4" @click="goHome">Go to Home</v-btn>
      </div>

      <!-- Error State -->
      <div v-else class="space-y-4">
        <div
          class="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-red-900/50"
        >
          <mdicon name="alert-circle" size="32" class="text-red-400" />
        </div>
        <h1 class="text-2xl font-bold text-text">Verification Failed</h1>
        <p class="text-gray-300">{{ errorMessage }}</p>
        <div class="mt-4 space-y-2">
          <v-btn @click="resendVerification">Resend Verification Email</v-btn>
          <p v-if="resendMessage" class="mt-2 text-sm text-green-400">
            {{ resendMessage }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from "vue";
import { useRoute, useRouter } from "vue-router";

import { isDefined } from "../../../../lib/checks/checks.js";

import { authClient } from "@/lib/auth-client";
import { useAuthStore } from "@/stores/auth";

const route = useRoute();
const router = useRouter();
const auth = useAuthStore();

const isVerifying = ref(true);
const isSuccess = ref(false);
const errorMessage = ref("");
const resendMessage = ref("");

onMounted(async () => {
  const token = route.query.token as string;

  if (!token) {
    isVerifying.value = false;
    errorMessage.value =
      "No verification token found. Please check your email for the verification link.";
    return;
  }

  try {
    const { error } = await authClient.verifyEmail({
      query: { token },
    });

    if (error) {
      isVerifying.value = false;
      if (isDefined(error.message) && error.message?.includes("expired")) {
        errorMessage.value =
          "This verification link has expired. Please request a new one.";
      } else if (
        isDefined(error.message) &&
        error.message?.includes("invalid")
      ) {
        errorMessage.value =
          "This verification link is invalid. Please request a new one.";
      } else {
        errorMessage.value =
          error.message ?? "Failed to verify email. Please try again.";
      }
      return;
    }

    isVerifying.value = false;
    isSuccess.value = true;
  } catch {
    isVerifying.value = false;
    errorMessage.value = "An unexpected error occurred. Please try again.";
  }
});

const goHome = () => {
  router.push({ name: "Clubs" }).catch(console.error);
};

const resendVerification = async () => {
  const email = auth.user?.email;
  if (!isDefined(email)) {
    resendMessage.value = "Please sign in first to resend verification email.";
    return;
  }

  try {
    await authClient.sendVerificationEmail({
      email,
      callbackURL: "/verify-email",
    });
    resendMessage.value = "Verification email sent! Please check your inbox.";
  } catch {
    resendMessage.value =
      "Failed to send verification email. Please try again.";
  }
};
</script>
