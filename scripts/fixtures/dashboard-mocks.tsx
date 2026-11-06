import React from "react";
import { useQuery } from "@tanstack/react-query";

const fixture = () => (window as any).dashboardFixture;
export const useRouter = () => ({ push: (url: string) => fixture().events.push({ type: "navigate", url }) });
export const useAuth = () => ({ currentUser: fixture().user });
export const useRolePermissions = () => ({ hasPermission: (key: string) => !fixture().denied.includes(key) });
export const useSmartPrefetch = () => ({ prefetchRoute() {}, prefetchProjects() {} });
export const useUsersQuery = () => ({ data: { users: fixture().staff } });
export const useSubplatesByProjectQuery = (id: unknown, options: any) => useQuery({
  queryKey: ["subplates", "by-project", String(id)],
  queryFn: async () => {
    const response = await fetch(`/api/subplate?projectid=${id}`);
    if (!response.ok) throw new Error("Fixture subplates failed");
    return (await response.json()).subplates;
  },
  enabled: options?.enabled !== false,
  retry: false,
});
export const principalFetch = (...args: Parameters<typeof fetch>) => window.fetch(...args);
export const broadcastQueryInvalidation = (key: unknown) => fixture().events.push({ type: "broadcast", key });
export const appStore = { addToast: (value: unknown) => fixture().events.push({ type: "toast", value }) };
function Integration({ isOpen, onClose, title }: any) {
  return isOpen ? <div role="dialog" aria-label={title}><button onClick={onClose}>Close integration</button>{title}</div> : null;
}
export const CreatePurchaseOrderModal = (props: any) => <Integration {...props} title="Purchase order integration" />;
export const MouldTimelineDrawer = (props: any) => <Integration {...props} title="Mould history integration" />;
export const MoveToRegisterModal = (props: any) => <Integration {...props} isOpen={!!props.project} title="Register integration" />;
export const AssignStaffModal = (props: any) => <Integration {...props} title="Staff assignment integration" />;
