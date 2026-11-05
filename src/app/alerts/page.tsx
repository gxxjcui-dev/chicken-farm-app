import AlertList from "@/components/AlertList";

export const dynamic = "force-dynamic";

export default function AlertsPage() {
  return (
    <div className="space-y-4">
      <h2 className="text-base font-bold text-gray-800">🔔 告警列表</h2>
      <AlertList />
    </div>
  );
}
