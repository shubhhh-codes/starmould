import React from "react";

const fixture = () => (window as any).subplateFixture;
export const useRouter = () => ({ push: (url: string) => fixture().events.push({ type: "navigate", url }) });
export const useSearchParams = () => new URLSearchParams();
export const useAuth = () => ({ currentUser: fixture().user });
export const useRolePermissions = () => ({ hasPermission: (key: string) => !fixture().denied.includes(key) });
export const useSubplatesQuery = () => ({
  data: fixture().loading ? undefined : { subplates: fixture().plates, scans: fixture().scans, users: fixture().staff },
  isLoading: fixture().loading, isFetching: false, error: null,
  refetch: async () => fixture().events.push({ type: "refetch-subplates" }),
});
export const useProjectsQuery = () => ({ data: { scans: fixture().scans }, isLoading: false, refetch: async () => fixture().events.push({ type: "refetch-projects" }) });
const mutation = (method: string) => ({ mutateAsync: async (body: unknown) => {
  fixture().events.push({ type: "mutation", method, body });
  if (fixture().failSave) throw new Error("Fixture save failed");
  return { success: true };
} });
export const useCreateSubplateMutation = () => mutation("POST");
export const useUpdateSubplateMutation = () => mutation("PUT");
export const useDeleteSubplateMutation = () => mutation("DELETE");
export const principalFetch = (...args: Parameters<typeof fetch>) => window.fetch(...args);
export const broadcastQueryInvalidation = (key: unknown) => fixture().events.push({ type: "broadcast", key });
export const appStore = { addToast: (value: unknown) => fixture().events.push({ type: "toast", value }) };
export const AppLayout = ({ children }: { children: React.ReactNode }) => <main>{children}</main>;
export const useTableHighlight = () => ({ getRowHighlightClass: () => "" });
export const getRecommendedCompanionPlates = () => [];
export const findContextualPlateGhost = () => null;
export const findTopContextualPlates = () => [];
export const learnSubplatePair = (first: string, second: string) => fixture().events.push({ type: "learn", first, second });
function Integration({ isOpen, onClose, title }: any) {
  return isOpen ? <div role="dialog" aria-label={title}><button onClick={onClose}>Close integration</button>{title}</div> : null;
}
export const CreatePurchaseOrderModal = (props: any) => <Integration {...props} title="Purchase order integration" />;
export const AssignStaffModal = (props: any) => <Integration {...props} title="Staff assignment integration" />;
