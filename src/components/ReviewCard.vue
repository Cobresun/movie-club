<template>
    <div class="border-2 border-gray-200 rounded w-40 mb-4">
        <div class="flex flex-col h-full">
            <img :src="moviePosterUrl" />
            <div class="px-2 pb-2 flex flex-col h-auto flex-grow">
                <div class="my-2 flex flex-grow items-center justify-center">
                    <h3 class="font-semibold h-min" style="height: min-content">{{ movieTitle }}</h3>
                </div>
                <div class="grid grid-cols-2 gap-2">
                    <div 
                        v-for="member in members" :key="member.name"
                        class="flex items-center bg-lowBackground rounded-3xl"
                    >
                        <avatar
                            :size="32"
                            :fullname="member.name"
                            :image="member.image"
                        ></avatar>
                        <div class="flex-grow text-sm">
                            {{ review.scores[member.name] }}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</template>

<script lang="ts">
import { Component, Vue, Prop } from 'vue-property-decorator'
import { ReviewResponse, Member } from '@/models'

@Component({
  components: { },
})

export default class ReviewView extends Vue {
    @Prop() review! : ReviewResponse
    @Prop() members! : Member[]
    @Prop() movieTitle! : string
    @Prop() moviePosterUrl! : string
}
</script>
