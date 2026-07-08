export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050d1e]">
      <div className="flex flex-col items-center gap-4">
        <div
          className="h-10 w-10 animate-spin rounded-full border-2 border-transparent"
          style={{
            borderTopColor: "#f5b942",
            borderRightColor: "rgba(96,165,250,0.3)",
          }}
        />
        <span className="text-sm text-[#9fb3d4]" style={{ fontFamily: "Sora, sans-serif" }}>
          Loading…
        </span>
      </div>
    </div>
  );
}
