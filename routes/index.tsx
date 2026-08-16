import { Head } from "fresh/runtime";
import { define } from "../utils.ts";
import TokenMaker from "../islands/TokenMaker.tsx";

export default define.page(function Home() {
  return (
    <div class="min-h-screen bg-zinc-950 text-zinc-100">
      <Head>
        <title>Token Maker — dnd-utilities</title>
      </Head>
      <main class="mx-auto max-w-5xl px-4 py-8">
        <header class="mb-6">
          <h1 class="text-3xl font-bold">D&D Token Maker</h1>
          <p class="mt-1 text-zinc-400">
            Upload character art and turn it into a VTT token — all in your
            browser.
          </p>
        </header>
        <TokenMaker />
      </main>
    </div>
  );
});
