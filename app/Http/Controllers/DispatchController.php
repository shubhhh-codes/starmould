<?php

namespace App\Http\Controllers;

use App\Models\DispatchItemsModel;
use App\Models\DispatchModel;
use App\Models\CustomerModel;
use App\Models\SubplateModel;
use App\Models\ScanningModel;
use App\Models\ViewModel;
use App\Models\ChallanItemsModel;
use App\Models\DispatchViewModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use Yajra\DataTables\DataTables as DataTables;

class DispatchController extends Controller
{
    public function index(Request $request)
    {
        //
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $data = CustomerModel::latest()->where('usertype','Vendor')->get();
        $datacus = CustomerModel::latest()->where('usertype','Customer')->get();
        $datavendor = CustomerModel::latest()->where('usertype','Transport')->get();
     //   $chdata = SubplateModel::select('id','platename')->get();
        return view('dispatch.index',["currentDateTime"=>$currentDateTime,"data"=>$data, "datavendor"=>$datavendor,"datacus"=>$datacus]);
        
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            $start = $request->input('start', 0); // Get the start index of the pagination
            $length = $request->input('length', 100); // Get the length of data to be fetched

            //$query = DispatchModel::where('status','1')->orderBy('id','DESC');
            $query = DispatchModel::with(['customer', 'transporter','dispatchItems'])->where('status', '1')->orderBy('id', 'DESC');

            $recordsTotal = $query->count(); // Total count of records
            $recordsFiltered = $recordsTotal = $query->count();

            $data = $query->offset($start)
                ->skip($start)
                ->take($length)
                ->limit($length);
                

            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            ->setTotalRecords($recordsTotal) // Set the total count of records
            ->setFilteredRecords($recordsFiltered) // Set the total count of filtered records
            // ->rawColumns(['scan_by'])
            ->addColumn('chdate',function($row){
                return [
                    'display' => Carbon::parse($row->chdate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->chdate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('customerid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->customerid)->get();
                $customerid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $customerid=$value->customername;
                    }  
                }
                return $customerid;
            }) 
            // ->addColumn('vendorid',function($row){
            //     $data1 = CustomerModel::latest()->where("id",$row->vendorid)->get();
            //     $vendorid="";
            //     if($data1->count()>0){
            //         foreach ($data1 as $key => $value) {
            //             # code...
            //             $vendorid=$value->customername;
            //         }  
            //     }
            //     return $vendorid;
            // }) 

            // ->filterColumn('vendorid', function($query, $keyword) {
            //     $query->whereHas('vendor', function($q) use ($keyword) {
            //         $q->where('customername', 'like', "%$keyword%");
            //     });
            // }) 


            ->addColumn('vendortid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vendortid)->get();
                $vendortid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vendortid=$value->customername;
                    }  
                }
                return $vendortid;
            }) 
            ->filterColumn('vendortid', function($query, $keyword) {
                $query->whereHas('transporter', function($q) use ($keyword) {
                    $q->where('customername', 'like', "%$keyword%");
                });
            })

            ->addColumn('invoiceno', function($row) {
                return $row->invoiceno;
            })
            ->addColumn('vehicleno', function($row) {
                return $row->vehicleno;
            })
            ->addColumn('deliverytype', function($row) {
                return $row->deliverytype;
            })
            ->addColumn('freightmode', function($row) {
                return $row->freightmode;
            })
            ->addColumn('freightcharge', function($row) {
                return $row->freightcharge;
            })
            ->addColumn('noofcases', function($row) {
                return $row->noofcases;
            })
            // and so on for deliverytype, freightmode, etc.

            
            ->addColumn('action', function($row){
                
                $chdate = Carbon::parse($row->chdate);
                $row->chdate=$chdate->format('d/m/Y');
                $json_string = json_encode($row, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES | JSON_NUMERIC_CHECK);
                $encoded_json = base64_encode($json_string);
                $btn = '<a href="javascript:Edit(atob(\''.$encoded_json.'\'))" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Edit</a>';
                
                   $btn.= '<a href="javascript:AskToDelete(\''.$row->id.'\')" class="btn btn-outline-danger waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Delete</a>';
                   $btn.= '<a href="'.route("dispatch2",['dispatch'=>$row->id]).'" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;" target="_blank">View</a>';
                //    $btn.= '<a href="'.route("challanimage",['challan'=>$row->id]).'" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;" target="_blank">image</a>';
             
                   return $btn;
            })
            ->rawColumns(['action'])
            ->make(true);
          //  return $data;                          
        }
    }
    public function getDitems(Request $request)
    {
        // Fetch plates linked to the dispatch
        $plateData = DispatchItemsModel::leftJoin('subplate', 'dispatch_items.plateid', '=', 'subplate.id')
            ->leftJoin('customers', 'dispatch_items.customer', '=', 'customers.id')
            ->leftJoin('scan', 'subplate.projectid', '=', 'scan.id')
            ->select(
                'dispatch_items.*',
                'subplate.platename as original_platename',
                'customers.customername',
                'scan.description'
            )
            ->where('dispatchid', '=', $request->dispatchid)
            ->get()
            ->map(function ($item) {
                // Replace with custom name if plateid is null or non-numeric
                $item->platename = (!is_numeric($item->plateid) || $item->plateid == null)
                    ? $item->custom_plate_name
                    : $item->original_platename;
    
                // Show custom qty if set
                $item->display_qty = (!is_numeric($item->plateid) || $item->plateid == null)
                    ? $item->custom_plate_qty
                    : $item->qty;
    
                unset($item->original_platename); // Remove unused field
                return $item;
            });
    
        // Note: Plate names are now fetched by the frontend using the same 
        // getdispatchprojectsubplatesview endpoint as the add modal
        return response()->json([
            'plateData' => $plateData
        ]);
    }
    
    public function store(Request $request)
{
    //dd($request);
    if ($request->id != "") {
        // Find the existing Challan model
        $dispatch = DispatchModel::findOrFail($request->id);
    
        // Update the Challan attributes
        $dispatch->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
        $dispatch->customerid = $request->input('customerid_hidden') ?? $request->input('customerid');
        $dispatch->vendorid = $request->input('vendorid');
        $dispatch->vendortid = $request->input('vendortid');
        $dispatch->projectid = $request->input('projectid');
        $dispatch->created_by = Auth::user()->name;
        //new 6 field below
        $dispatch->invoiceno = $request->input('invoiceno');
        $dispatch->vehicleno = $request->input('vehicleno');
        $dispatch->deliverytype = $request->input('deliverytype');
        $dispatch->freightmode = $request->input('freightmode');
        $dispatch->freightcharge = $request->input('freightcharge');
        $dispatch->noofcases = $request->input('noofcases');

    
        // Save the updated Challan model to the database
        $dispatch->save();
    
        // First, get all existing item IDs for this dispatch
        $existingItemIds = DispatchItemsModel::where('dispatchid', $dispatch->id)->pluck('id')->toArray();
        
        // Process the updated items
        $pids = $request->input('pids', []);
        $dispatchid = $request->input('dispatchid', []);
        $customer = $request->input('customer', []);
        $project = $request->input('project', []);
        $categoryIds = $request->input('categories', []);
        $particulars = $request->input('particulars', []);
        $condition = $request->input('condition', []);
        $work = $request->input('work', []);
        $qtys = $request->input('qty', []);
        $customPlateNames = $request->input('custom_plate_name', []);
        $customPlateQtys = $request->input('custom_plate_qty', []);
        
        $processedItemIds = [];
        $customIndex = 0;
        
        // Validate row counts
        $rowCount = count($categoryIds);
        if ($rowCount === count($customer) && 
            $rowCount === count($project) && 
            $rowCount === count($particulars) && 
            $rowCount === count($condition) && 
            $rowCount === count($work) &&
            $rowCount === count($qtys) + count($customPlateQtys)) {
            
            for ($index = 0; $index < $rowCount; $index++) {
                $pid = isset($pids[$index]) ? $pids[$index] : null;
                $categoryValue = $categoryIds[$index];
                
                if ($pid && $pid != "") {
                    // Update existing item
                    $item = DispatchItemsModel::find($pid);
                    if ($item) {
                        $processedItemIds[] = $pid;
                        
                        $item->customer = isset($customer[$index]) ? $customer[$index] : null;
                        $item->project = isset($project[$index]) ? $project[$index] : null;
                        $item->particulars = isset($particulars[$index]) ? $particulars[$index] : null;
                        $item->condition = isset($condition[$index]) ? $condition[$index] : null;
                        $item->work = isset($work[$index]) ? $work[$index] : null;
                        
                        if (empty($categoryValue)) {
                            // It's a custom plate
                            $item->custom_plate_name = $customPlateNames[$customIndex] ?? 'Unnamed';
                            $item->custom_plate_qty = $customPlateQtys[$customIndex] ?? null;
                            $item->qty = $customPlateQtys[$customIndex] ?? null;
                            $item->plateid = null;
                            $customIndex++;
                        } else {
                            // It's a regular dropdown plate
                            $parts = explode(',', $categoryValue, 2);
                            $item->plateid = $parts[0];
                            $item->qty = $qtys[$index - $customIndex] ?? null;
                            $item->custom_plate_name = null;
                            $item->custom_plate_qty = null;
                        }
                        
                        $item->save();
                    }
                } else {
                    // Create new item
                    $item = new DispatchItemsModel();
                    $item->dispatchid = $dispatch->id;
                    $item->customer = isset($customer[$index]) ? $customer[$index] : null;
                    $item->project = isset($project[$index]) ? $project[$index] : null;
                    $item->particulars = isset($particulars[$index]) ? $particulars[$index] : null;
                    $item->condition = isset($condition[$index]) ? $condition[$index] : null;
                    $item->work = isset($work[$index]) ? $work[$index] : null;
                    
                    if (empty($categoryValue)) {
                        // It's a custom plate
                        $item->custom_plate_name = $customPlateNames[$customIndex] ?? 'Unnamed';
                        $item->custom_plate_qty = $customPlateQtys[$customIndex] ?? null;
                        $item->qty = $customPlateQtys[$customIndex] ?? null;
                        $item->plateid = null;
                        $customIndex++;
                    } else {
                        // It's a regular dropdown plate
                        $parts = explode(',', $categoryValue, 2);
                        $item->plateid = $parts[0];
                        $item->qty = $qtys[$index - $customIndex] ?? null;
                    }
                    
                    $item->save();
                    $processedItemIds[] = $item->id;
                }
            }
            
            // Delete items that were removed from the form
            $itemsToDelete = array_diff($existingItemIds, $processedItemIds);
            if (!empty($itemsToDelete)) {
                DispatchItemsModel::whereIn('id', $itemsToDelete)->delete();
            }
        }  
    } else 
    {   
        // $customPlateNames = $request->input('custom_plate_name', []);
        // $customPlateQtys = $request->input('custom_plate_qty', []);
        // $qtys = $request->input('qty', []);
        // dd($request->all(),$customPlateNames,$customPlateQtys, count($qtys) + count($customPlateQtys));
        $categoryIds = $request->input('categories', []);

        $challan = new DispatchModel();
        $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
        $challan->customerid = $request->input('customerid_hidden') ?? $request->input('customerid');
        // $challan->vendorid = $request->input('vendorid');
        $challan->vendortid = $request->input('vendortid');
        $challan->projectid = $request->input('projectid');
        $challan->created_by = Auth::user()->name;
         //new 6 field below
         $challan->invoiceno = $request->input('invoiceno');
         $challan->vehicleno = $request->input('vehicleno');
         $challan->deliverytype = $request->input('deliverytype');
         $challan->freightmode = $request->input('freightmode');
         $challan->freightcharge = $request->input('freightcharge');
         $challan->noofcases = $request->input('noofcases');

        // $datac = DispatchModel::select('*')->get();
        // $challnid = $datac->count() + 1;

        // if ($challnid < 10) {
        //     $challan->challanno = "SM/DC/0" . $challnid;
        // } else {
        //     $challan->challanno = "SM/DC/" . $challnid;
        // }

        //$challan->challanno = "SM/DC/" . str_pad($challnid, 4, "0", STR_PAD_LEFT);
        $lastId = DispatchModel::max('id'); // get highest existing ID
        $nextId = $lastId ? $lastId + 1 : 1;
        $challan->challanno = "SM/DC/" . str_pad($nextId, 4, "0", STR_PAD_LEFT);

        $challan->save();
        // Get all arrays
        $categoryIds = $request->input('categories', []);
        $customPlateNames = $request->input('custom_plate_name', []);
        $customPlateQtys = $request->input('custom_plate_qty', []);
        $customers = $request->input('customer', []);
        $projectids = $request->input('project', []);
        $particulars = $request->input('particulars', []);
        $condition = $request->input('condition', []);
        $work = $request->input('work', []);
        $qtys = $request->input('qty', []);

        // Validate consistency
        $rowCount = count($categoryIds);
        if (
            $rowCount === count($customers) &&
            $rowCount === count($projectids) &&
            $rowCount === count($particulars) &&
            $rowCount === count($condition) &&
            $rowCount === count($work) &&
            $rowCount === count($qtys) + count($customPlateQtys)
        ) {
            $customIndex = 0; // Separate index for custom plates

            for ($index = 0; $index < $rowCount; $index++) {
                $categoryValue = $categoryIds[$index];
                $particular = $particulars[$index] ?? null;
                $cond = $condition[$index] ?? null;
                $wrk = $work[$index] ?? null;
                $cust = $customers[$index] ?? null;
                $proj = $projectids[$index] ?? null;

                $item = new DispatchItemsModel();
                $item->dispatchid = $challan->id;
                $item->customer = $cust;
                $item->project = $proj;
                $item->particulars = $particular;
                $item->condition = $cond;
                $item->work = $wrk;

                if (empty($categoryValue)) {
                    // It's a custom plate
                    $item->custom_plate_name = $customPlateNames[$customIndex] ?? 'Unnamed';
                    $item->custom_plate_qty = $customPlateQtys[$customIndex] ?? null;
                    $item->qty = $customPlateQtys[$customIndex] ?? null;
                    $item->plateid = null;
                    $customIndex++; // increment only when using custom plates
                } else {
                    // It's a regular dropdown plate
                    $parts = explode(',', $categoryValue, 2);
                    $item->plateid = $parts[0];
                    $item->qty = $qtys[$index - $customIndex] ?? null; // qty index shifts left as custom items grow
                }

                $item->save();
            }

        } else {
            return redirect()->back()->with('error', 'Mismatch in item row counts. Please check form.');
        }
    }
            
    return redirect()->back()->with('success', 'Challan created/updated successfully!');
}
 public function destroy($id)
    {
        $model=DispatchModel::where("id", $id)->update(["status" => "0"]);
        return redirect(route('dispatchlist'));
    }
}