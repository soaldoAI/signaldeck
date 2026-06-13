export default function Home() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <h1 className="text-4xl font-semibold tracking-tight">SignalDeck</h1>
      <p className="max-w-md text-lg text-neutral-500">
        Don&apos;t show me messages. Tell me what matters.
      </p>
      <p className="text-sm text-neutral-400">
        Setup wizard arrives in Phase&nbsp;2.
      </p>
    </main>
  );
}
