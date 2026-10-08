// Re-mounts on every navigation, giving each page a short settle-in transition (disabled for reduced motion).
export default function Template({ children }: { children: React.ReactNode }) {
  return <div className="route-enter">{children}</div>;
}
