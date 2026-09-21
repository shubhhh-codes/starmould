export type RoleName = 'admin' | 'manager' | 'supervisor' | 'designer' | 'worker';

export interface Role {
  id: number;
  name: RoleName;
  display_name: string;
  description: string | null;
  created_at: string;
}

export interface UserProfile {
  id: number;
  auth_id: string | null;
  name: string;
  email: string;
  role_id: number;
  status: number;
  username: string;
  initials: string;
  usertype: string;
  usersubtype: string;
  created_at: string;
  updated_at: string;
}

export type User = UserProfile;

export interface Customer {
  id: number;
  customername: string;
  mobile: string | null;
  mobile1: string | null;
  email: string | null;
  initials: string;
  address: string | null;
  usertype: 'Customer' | 'Vendor' | 'Transport' | 'Other' | string;
  created_at: string;
  updated_at: string;
}

export interface ScanProject {
  id: number;
  rdate: string;
  cdate: string;
  dispatchdate: string;
  cname: string;
  customername?: string;
  description: string;
  note: string | null;
  scan_by: number;
  qc_by: number | null;
  modeldesign_by: number;
  payment: number;
  mail_done: number | null;
  worktype: string | null;
  scan_hr: number | null;
  model_hr: number | null;
  sr_scanhr: number;
  sr_modelhr: number;
  amount: number;
  status: 'pending' | 'registered' | 'completed';
  projectid: string | null;
  subnote: string | null;
  created_at: string;
  created_by: number | null;
  updated_at: string;
  total_plates?: number;
  completed_plates?: number;
}

export interface Subplate {
  id: number;
  platename: string;
  projectid: string;
  subprojectid: string | null;
  shape: string | null;
  width: number | null;
  height: number | null;
  length: number | null;
  weight: number | null;
  unit: string | null;
  material: string | null;
  sqty: number;
  photo: string | null;
  design_by: number | null;
  order_by: number | null;
  received_workby: number | null;
  received_qcby: number | null;
  vmc_workby: number | null;
  vmc_qcby: number | null;
  drilltap_workby: number | null;
  final_qcby: number | null;
  packing_workby: number | null;
  packing_photo: string | null;
  location: string;
  created_at: string;
  updated_at: string;
}

export interface PipelineStats {
  scantotal: number;
  samplecount: number;
  designby: number;
  orderby: number;
  receivedworkby: number;
  receivedqcby: number;
  vmcworkby: number;
  vmcqcby: number;
  drilltapworkby: number;
  finalqcby: number;
  packingworkby: number;
}

export interface PurchaseItem {
  id: number;
  pid: number;
  plateid: number;
  material: string; // dimensions/spec
  materialtype: string; // Aluminium, MS-Black, etc.
  qty: number;
  platename?: string;
  created_at?: string;
  updated_at?: string;
}

export interface PurchaseOrder {
  id: number;
  srno: string; // e.g. "PO-1010"
  purchaseid: number;
  pno: string | null;
  vname: number; // vendor customer id
  cname: number; // client customer id
  odate: string; // YYYY-MM-DD
  projectid: string; // mould project code
  status: '1' | '0' | string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  items?: PurchaseItem[];
  vendorname?: string;
  customername?: string;
  description?: string;
}

export interface PurchaseInwardItem {
  id: number;
  pid?: number;
  inpid?: number;
  plateid: number;
  imaterial: string;
  material: string;
  materialtype: string;
  qty: number;
  inward_qty: number;
  pending_qty: number;
  platename?: string;
}

export interface PurchaseInwardReceipt {
  id: number;
  pid: number; // references purchase.id
  insrno: string; // e.g. "SM/PR/01"
  inpono: string | null; // vendor challan/delivery note
  cname: number;
  vname: number;
  projectid: string;
  odate: string; // receive date
  status: '1' | '0' | string;
  created_at?: string;
  vendorname?: string;
  customername?: string;
  items?: PurchaseInwardItem[];
}

export interface ViewPoPendingInwardQty {
  id: number;
  srno: string;
  pno: string | null;
  vname: number;
  vendorname: string;
  cname: number;
  customername: string;
  projectid: string;
  description?: string;
  odate: string;
  plateid: number;
  platename: string;
  material: string;
  materialtype: string;
  qty: number;
  inward_qty: number;
  pending_qty: number;
}

// Authentic material list from resources/views/scanning/index.blade.php (<select id="material"> lines 714-739)
export const SCANNING_MATERIALS = [
  'Acralic',
  'Aluminium',
  'Brass',
  'C45',
  'Copper',
  'D-2',
  'Derlin',
  'EN8',
  'Gun Metal',
  'MS-Black',
  'MS-Bright',
  'Nylon',
  'O-ring',
  'Rubber',
  'Silver Bar',
  'Spring',
  'SS',
  'SS-202',
  'SS-304',
  'U-seal',
  'Wood',
  'Wooden Box',
  'WPS',
] as const;

export type ScanningMaterial = (typeof SCANNING_MATERIALS)[number];

// Phase 2d: Challan, Dispatch, Inward Types
export interface ChallanItem {
  id: number;
  challanid: number;
  plateid: number;
  particulars: string;
  customer: number;
  project: string;
  qty: number;
  platename?: string;
  customername?: string;
  description?: string;
}

export interface Challan {
  id: number;
  challanno: string; // e.g. "SM/JW/01"
  customerid: number;
  vendorid: number;
  vendortid: number;
  projectid: string;
  subprojectid?: number;
  chdate: string; // YYYY-MM-DD
  status: '1' | '0' | string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  items?: ChallanItem[];
  customername?: string;
  vendorname?: string;
  transportername?: string;
}

export interface DispatchItem {
  id: number;
  dispatchid: number;
  plateid: number | null;
  custom_plate_name?: string | null;
  custom_plate_qty?: number | null;
  particulars?: string | null;
  condition?: string | null;
  work?: string | null;
  customer: number;
  project: string;
  qty: number;
  platename?: string;
  customername?: string;
  description?: string;
}

export interface Dispatch {
  id: number;
  challanno: string; // e.g. "SM/DC/0001"
  customerid: number;
  vendorid?: number | null;
  vendortid: number;
  projectid: string;
  subprojectid?: number;
  chdate: string;
  invoiceno: string;
  vehicleno: string;
  deliverytype: 'Door Delivery' | 'Godown Delivery' | 'Door Pickup' | 'Hand To Hand' | string;
  freightmode: 'To Pay' | 'Paid' | string;
  freightcharge: string;
  noofcases: string;
  status: '1' | '0' | string;
  created_by: string;
  created_at?: string;
  updated_at?: string;
  items?: DispatchItem[];
  customername?: string;
  transportername?: string;
}

export interface InwardItem {
  id: number;
  challanid: number; // outward challan id
  inchallanid: number; // inward receipt id
  plateid: number;
  particulars: string;
  customer: number;
  project: string;
  cdescription?: string;
  qty: number; // outward qty
  inward_qty: number; // received qty
  pending_qty?: number;
  platename?: string;
  customername?: string;
}

export interface Inward {
  id: number;
  challanid: number; // references outward challan.id
  inchallanno: string; // e.g. "SM/IW/01"
  customerid?: number | null;
  vendorid: number;
  vendortid: number;
  projectid: string;
  subprojectid?: number;
  chdate: string;
  status: '1' | '0' | string;
  created_by: string | number;
  created_at?: string;
  updated_at?: string;
  items?: InwardItem[];
  challanno?: string; // outward challan number
  vendorname?: string;
  transportername?: string;
  customername?: string;
}

export interface ViewPendingInwardQty {
  id: number;
  customername: string;
  vendorname: string;
  transportername: string;
  vendorid: number;
  customer: number;
  challanno: string;
  vendortid: number;
  projectid: string;
  created_by: string;
  chdate: string;
  plateid: number;
  particulars: string;
  qty: number;
  inward_qty: number;
  pending_qty: number;
  platename: string;
}

export interface ViewPendingDispatchQty {
  projectid: string;
  projectname: string;
  plateid: number;
  platename: string;
  sqty: number;
  pqty: number;
  oqty: number;
}

export interface ViewPendingOutwordQty {
  projectid: string;
  projectname: string;
  plateid: number;
  platename: string;
  sqty: number;
  pqty: number;
  oqty: number;
}

export interface Expense {
  id: number;
  customerid: number;
  description: string;
  payment_mode: 'Cash' | 'Gpay' | 'Check' | 'NEFT' | string;
  payment_type: 'Credit' | 'Debit' | 'Outstanding' | string;
  amount: number;
  balance: number;
  rdate: string;
  created_at?: string;
  updated_at?: string;
  customername?: string;
}

export interface Worklog {
  id: number;
  scan_print_id: number;
  customerid: number;
  projectid: string;
  subplateid: string | null;
  work_hr: string;
  sdate: string | null;
  edate: string | null;
  starttime: string;
  endtime: string;
  workdescription: string;
  design_hr: number;
  program_hr: number;
  machine_hr: number;
  driltap_hr: number;
  qc_hr: number;
  userid: number;
  rdate: string | null;
  created_at?: string;
  updated_at?: string;
  customername?: string;
  username?: string;
  userinitials?: string;
}

export interface PrintProject {
  id: number;
  cname: string;
  projectid: string;
  description: string;
  tdate: string;
  cdate: string;
  gram: number;
  hr: number;
  pr_printhr: number;
  amount: number;
  ramount: number;
  print_by: number;
  qc_by: number;
  payment: number;
  dispatch: number;
  status: 'pending' | 'completed' | string;
  created_at?: string;
  updated_at?: string;
}

export interface GramCalc {
  id: number;
  fix: number;
  multiply: number;
  lessthan: number;
  graterthan: number;
  created_at?: string;
  updated_at?: string;
}

