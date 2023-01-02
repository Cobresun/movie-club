<template>
<div>
    <!-- TODO: the page header component checks for a club, lets not do that here! -->
    <page-header :has-back="false" page-name="New Club" />

    <div v-if="isLoggedIn">
        <div>
            <input
                id="club-name"
                v-model="clubName"
                placeholder="Club name"
                type="text"
                class="mb-4 p-2 text-base text-black outline-none rounded-md border-2 border-gray-300 focus:border-primary w-11/12 max-w-md"
            />

            <h2 class="text-2xl m-4">Add Members</h2>
            <div>
                <!-- TODO: Align these input fields with the buttons correctly -->
                <div
                    v-for="(member, memberIndex) in members"
                    :key="memberIndex"
                >
                    <input
                        v-model="members[memberIndex]"
                        placeholder="Email address"
                        type="text"
                        class="mb-4 p-2 text-base text-black outline-none rounded-md border-2 border-gray-300 focus:border-primary w-11/12 max-w-md"
                    />
                    <v-btn
                        v-if="memberIndex > 0"
                        class="align-middle m-2"
                        @click="members.splice(memberIndex, 1)"
                    >
                        <mdicon name="minus" />
                    </v-btn>
                </div>
            </div>
        </div>

        <div class="flex justify-evenly">
            <v-btn @click="members.push('')">
                Add member
                <mdicon name="plus" />
            </v-btn>

            <v-btn @click="submit()">
                Create club
            </v-btn>
        </div>
    </div>
    <div v-else>
        Must be logged in to create a new club!
    </div>
</div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue';

import { useCreateClub } from '@/service/useClub';
import { useAuthStore } from '@/stores/auth';

const clubName = ref("");
const members = ref([""]);

const authStore = useAuthStore();
const isLoggedIn = computed(() => authStore.isLoggedIn);

const { createClub } = useCreateClub();

const submit = () => {
    // TODO: input validation
    // TODO: show error on input fields that are invalid
    // TODO: don't allow submitting without everything valid

    if (authStore.user) {
        // TODO: init members to start with authStore.user.email and make that input field non-editable
        // TODO: then I won't need to check if they're in there
        if (!members.value.includes(authStore.user.email)) {
            members.value.push(authStore.user.email);
        }

        // TODO: if successful, return the user to the ClubsView
        createClub(clubName.value, members.value);
    }
}
</script>
