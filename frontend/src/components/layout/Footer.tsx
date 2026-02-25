export function Footer() {
  return (
    <footer className="border-t border-border mt-auto">
      <div className="max-w-7xl mx-auto px-4 py-6 flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted">
          P2P Marketplace on BNB Smart Chain
        </p>
        <div className="flex items-center gap-4 text-sm text-muted">
          <span>Platform Fee: 2%</span>
          <span>|</span>
          <span>Non-custodial Escrow</span>
        </div>
      </div>
    </footer>
  );
}
