import { ComputedRef, Ref } from 'vue'
export type LayoutKey = "blank" | "default"
declare module "C:/Users/BiGoo/OneDrive/Desktop/ยังไม่เก็บไฟล์/nuxtjs/test-nuxt/demo/01/package/node_modules/nuxt/dist/pages/runtime/composables" {
  interface PageMeta {
    layout?: false | LayoutKey | Ref<LayoutKey> | ComputedRef<LayoutKey>
  }
}