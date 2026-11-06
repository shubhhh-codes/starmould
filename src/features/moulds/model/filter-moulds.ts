import type { ScanProject } from "@/lib/supabase/types";

export function filterMoulds(data: ScanProject[], selectedCustomer: string, selectedWorktype: string) {
  return data.filter((item) => {
    if (
      selectedCustomer !== "ALL" &&
      item.cname !== selectedCustomer &&
      item.customername !== selectedCustomer &&
      String(item.customer_id) !== selectedCustomer
    ) {
      return false;
    }
    if (selectedWorktype !== "ALL" && item.worktype !== selectedWorktype) {
      return false;
    }
    return true;
  });
}
