// Templates remount on every navigation, so each Academy section gets a fresh enter transition.
export default function AcademyTemplate({ children }: { children: React.ReactNode }) {
  return <div className="route-in">{children}</div>;
}
