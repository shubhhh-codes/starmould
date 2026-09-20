<?php

namespace App\Http\Controllers;


use App\Models\CustomerModel;
use App\Models\PurchaseInwardItemsModel;
use App\Models\PurchaseItemsModel;
use App\Models\ViewPurchaseModel;
use App\Models\PurchaseModel;
use App\Models\ScanningModel;
use App\Models\SubplateModel;
use App\Models\UserModel;
use App\Models\WorkModel;
use Carbon\Carbon;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Yajra\DataTables\DataTables as DataTables;

class PurchaseController extends Controller
{
    //
    public function index()
    {
        //
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $vendordata = CustomerModel::latest()->where('usertype','Vendor')->get();
        $data = ScanningModel::join('customers', 'scan.cname', '=', 'customers.id')
        ->where('customers.usertype', 'Customer')
        ->where('scan.status','=', 'pending')
        ->groupBy('scan.cname','customername','id')
        ->select('scan.cname','customers.id AS id','customers.customername AS customername') // Select the columns from the "scans" table that you need
        ->get();
    
        $data1 = ScanningModel::latest()->get(); 
        $data2 = UserModel::latest()->get();    
        // $amount = WorkModel::where('userid',Auth::user()->id)->whereDate('rdate', Carbon::today())->get()->sum(function($t){ 
        //     return  $t->work_hr + $t->program_hr + $t->machine_hr + $t->driltap_hr +$t->qc_hr; 
        // });
        $amountInMinutes = WorkModel::where('userid', Auth::user()->id)
        ->whereDate('rdate', Carbon::today())
        ->get()
        ->sum(function($t) {
            $timeParts = explode(':', $t->work_hr);
            $hoursInMinutes = intval($timeParts[0]) * 60;
            $minutes = intval($timeParts[1]);
            return $hoursInMinutes + $minutes;
        });

        $hours = floor($amountInMinutes / 60);
        $minutes = $amountInMinutes % 60;
        $formattedAmount = sprintf('%02d:%02d', $hours, $minutes);

    //  print_r($amount);
        return view('purchase.index',["data"=>$data,"data1"=>$data1,"amount"=>$formattedAmount,"data2"=>$data2,"currentDateTime"=>$currentDateTime,"vendordata"=>$vendordata]);
    }
    public function pendingpurchaselist(Request $request)
    {
        return view('purchase.pendingpurchaselist');
    }
    public function purchaseitems(Request $request)
    {
        return view('purchase.purchaseitems');
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            $start = $request->input('start', 0); // Get the start index of the pagination
            $length = $request->input('length', 100); // Get the length of data to be fetched
            // $data = PurchaseModel::where('status','1')->get();
            $query = PurchaseModel::where('status','1')->orderBy('id','DESC');
            // $data = WorkModel::latest()->where('userid',Auth::user()->id)->whereRaw('Date(created_at) = CURDATE()')->get();
            $recordsTotal = $query->count(); // Total count of records
            $recordsFiltered = $recordsTotal = $query->count();

            $data = $query->offset($start)
                ->skip($start)
                ->take($length)
                ->limit($length);
                

            return DataTables::of($data)
            ->addIndexColumn() 
            ->setTotalRecords($recordsTotal) // Set the total count of records
            ->setFilteredRecords($recordsFiltered) // Set the total count of filtered records
            ->addColumn('subplateid',function($row){
                $data1 = SubplateModel::latest()->where("subprojectid",$row->subplateid)->get();
                $subplate="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $subplate=$value->platename;
                    }
                    
                }
                return $subplate;
            })
            ->addColumn('vname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vname)->where('usertype','Vendor')->get();
                $vname="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vname=$value->customername;
                    }
                    
                }
                return $vname;
            })
            ->filterColumn('vname', function($query, $keyword) {
                $query->whereHas('vendor', function($q) use ($keyword) {
                    $q->where('customername', 'like', "%$keyword%");
                });
            }) 
            ->addColumn('cname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
                $cname="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $cname=$value->customername;
                    }
                    
                }
                return $cname;
            })
            ->filterColumn('cname', function($query, $keyword) {
                $query->whereHas('customer', function($q) use ($keyword) {
                    $q->where('customername', 'like', "%$keyword%");
                });
            }) 
            ->addColumn('odate',function($row){
                return [
                    'display' => e(Carbon::parse($row->odate)->format('d-m-Y')),
                    'timestamp' => $row->odate
                 ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
         
            ->addColumn('worktype', function($row){
                $d="";
                if($row->projectid){
                    $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->cname)->get();
                    // $res='<option value="">Select Project</option>';
                    foreach ($data as $key => $value) {
                        $d=$value->worktype;
                        
                    }
                }
                
                 return $d;
            }) 
            ->addColumn('description', function($row){
                $d="";
                if($row->projectid){
                    $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->cname)->get();
                    // $res='<option value="">Select Project</option>';
                    foreach ($data as $key => $value) {
                        $d=$value->description;
                        
                    }
                }
                 return $d;
            })             
            ->addColumn('action', function($row){
                $odate = Carbon::parse($row->odate);
                $row->odate=$odate->format('d/m/Y');
                
                $d="";
                $d1="";
                if($row->projectid){
                    $data=ScanningModel::where("projectid",$row->projectid)->where("cname",$row->cname)->get();
                    // $res='<option value="">Select Project</option>';
                    foreach ($data as $key => $value) {
                        $d=str_replace("\"","<>",$value->description);
                        $d1=$value->worktype;
                        
                    }
                }
               
                // $row->description=str_replace("\"","<>",$row->description);
                if((Auth::user()->role == 0) ||  (Auth::user()->role == 1)){
                // $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$d1.'\',\''.$d.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm">Edit</a>';
                $btn = '<a href="javascript:AskToDelete(\''.$row->id.'\')" class="btn btn-outline-danger waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Delete</a>';
                $btn.= '<a href="'.route("purchase4",['purchase'=>$row->id]).'" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;" target="_blank">View</a>';
          
                 return $btn;
                }
            }) 
            ->rawColumns(['action'])
            
            ->make(true);
          //  return $data;                          
        }
    }
    
    public function getPData(Request $request)
    {
        if ($request->ajax()) {
            // $data = ChallanModel::where('status','1')->get();
            $data = ViewPurchaseModel::where('pending_qty','!=', 0)->groupBy('id')->get(); 
            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            // ->rawColumns(['scan_by'])
            ->addColumn('odate',function($row){
                return [
                    'display' => Carbon::parse($row->odate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->odate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('cname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
                $customerid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $customerid=$value->customername;
                    }  
                }
                return $customerid;
            }) 
            ->addColumn('description',function($row){
                $data1 = ScanningModel::latest()->where("projectid",$row->projectid)->get();
                $description="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $description=$value->description;
                    }  
                }
                return $description;
            }) 
            ->addColumn('vname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vname)->get();
                $vendorid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vendorid=$value->customername;
                    }  
                }
                return $vendorid;
            }) 
            // ->addColumn('challanno1', function($row) {
            //     $link = route('challan2', ['purchase' => $row->id]);
            //     return '<a href="' . $link . '" target="_blank" style="color: #5277e9 !important;">' . $row->challanno . '</a>';
            // })
            ->addColumn('inward', function($row){
                $odate = Carbon::parse($row->odate);
                $row->odate=$odate->format('d/m/Y');
                $row->platename=str_replace("\"","<>",$row->platename);
                $btn = '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:View('.htmlspecialchars(json_encode(str_replace("'", "\'", $row), JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8').')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1">Receive</a>';
                 return $btn;
            })
            ->rawColumns(['inward'])
            ->make(true);
          //  return $data;                          
        }
    }
    public function getPRData(Request $request)
    {
        if ($request->ajax()) {
            // $data = ChallanModel::where('status','1')->get();
            $data = ViewPurchaseModel::where('pending_qty','==', 0)->groupBy('id')->get(); 
            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            // ->rawColumns(['scan_by'])
            ->addColumn('odate',function($row){
                return [
                    'display' => Carbon::parse($row->odate)->format('d-m-Y'),
                    'timestamp' => Carbon::parse($row->odate)->timestamp,
                ];
                //return Carbon::parse($row->rdate)->format('d-m-Y');
            })
            ->addColumn('cname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
                $customerid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $customerid=$value->customername;
                    }  
                }
                return $customerid;
            }) 
            ->addColumn('description',function($row){
                $data1 = ScanningModel::latest()->where("projectid",$row->projectid)->get();
                $description="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $description=$value->description;
                    }  
                }
                return $description;
            }) 
            ->addColumn('vname',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vname)->get();
                $vendorid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vendorid=$value->customername;
                    }  
                }
                return $vendorid;
            }) 
            // ->addColumn('challanno1', function($row) {
            //     $link = route('challan2', ['purchase' => $row->id]);
            //     return '<a href="' . $link . '" target="_blank" style="color: #5277e9 !important;">' . $row->challanno . '</a>';
            // })
            // ->addColumn('inward', function($row){
            //     $odate = Carbon::parse($row->odate);
            //     $row->odate=$odate->format('d/m/Y');
            //     $row->platename=str_replace("\"","<>",$row->platename);
            //     $btn = '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:View('.htmlspecialchars(json_encode(str_replace("'", "\'", $row), JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8').')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1">Receive</a>';
            //      return $btn;
            // })
            // ->rawColumns(['inward'])
            ->make(true);
          //  return $data;                          
        }
    }
    public function getPurchaseData(Request $request)
    {
        if ($request->ajax()) {
            $data = SubplateModel::leftJoin('view_po_pending_inward_qty', 'subplate.id', '=', 'view_po_pending_inward_qty.plateid')
            ->whereNull('view_po_pending_inward_qty.plateid')
            ->select('subplate.*')
            ->get();
            // $projectIds = ScanningModel::join('subplate', 'scanmodel.id', '=', 'subplate.project_id')
            //  ->pluck('scanmodel.projectid');

// $projectIds now contains the projectid values from ScanModel where the id matches in the subplate table.

            // $data = ViewPurchaseModel::where('pending_qty','=', 0)->groupBy('id')->get(); 
            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
            ->addColumn('projectid',function($row){
                $data1 = ScanningModel::select('projectid','id')->where("id",$row->projectid)->get();
                // dd($data1);
                $projectids="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $projectids=$value->projectid;
                    }  
                }
                return $projectids;
            }) 
            // ->rawColumns(['scan_by'])
            // ->addColumn('odate',function($row){
            //     return [
            //         'display' => Carbon::parse($row->odate)->format('d-m-Y'),
            //         'timestamp' => Carbon::parse($row->odate)->timestamp,
            //     ];
            //     //return Carbon::parse($row->rdate)->format('d-m-Y');
            // })
            // ->addColumn('cname',function($row){
            //     $data1 = CustomerModel::latest()->where("id",$row->cname)->get();
            //     $customerid="";
            //     if($data1->count()>0){
            //         foreach ($data1 as $key => $value) {
            //             # code...
            //             $customerid=$value->customername;
            //         }  
            //     }
            //     return $customerid;
            // }) 
            // ->addColumn('vname',function($row){
            //     $data1 = CustomerModel::latest()->where("id",$row->vname)->get();
            //     $vendorid="";
            //     if($data1->count()>0){
            //         foreach ($data1 as $key => $value) {
            //             # code...
            //             $vendorid=$value->customername;
            //         }  
            //     }
            //     return $vendorid;
            // }) 
            // // ->addColumn('challanno1', function($row) {
            // //     $link = route('challan2', ['purchase' => $row->id]);
            // //     return '<a href="' . $link . '" target="_blank" style="color: #5277e9 !important;">' . $row->challanno . '</a>';
            // // })
            // ->addColumn('inward', function($row){
            //     $odate = Carbon::parse($row->odate);
            //     $row->odate=$odate->format('d/m/Y');
            //     $btn = '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:View(\''.(str_replace("\"","\\'",json_encode($row,true))).'\',\''.$row->id.'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1">Receive</a>';
            //      return $btn;
            // })
            ->rawColumns(['inward'])
            ->make(true);
          //  return $data;                          
        }
    }
    public function store(Request $request)
    {
        //
        if($request->id!=""){
            $purchase=PurchaseModel::findOrFail($request->id);
            $purchase->odate=Carbon::createFromFormat('d/m/Y', $request->input('odate'))->format('Y-m-d');//date('Y-m-d H:i:s' , strtotime($request->rdate));
            $purchase->vname=$request->input('vname');
            $purchase->cname=$request->input('cname');
            $purchase->subplateid=$request->input('subplateid');
            $purchase->projectid=$request->input('projectid');
            $purchase->created_by = Auth::user()->name;

            // $model->materialtype=$request->materialtype;                  
            // $model->rmaterial=$request->rmaterial;
            // $model->qty=$request->qty;
            $purchase->save();
            $pids = $request->input('pids', []);
            $purid = $request->input('pid', []);
            $categoryIds = $request->input('categories', []);
            // $descriptions = $request->input('cdescription', []);
            $materialtype = $request->input('materialtype', []);
            $rmaterial = $request->input('rmaterial', []);
            $qtys = $request->input('qty', []);
       
            if ((count($categoryIds) == count($materialtype)) && (count($categoryIds) == count($rmaterial)) && (count($categoryIds) == count($qtys))) {
                foreach ($pids as $index => $pid) {
                    if ($pid != "" && $pid != null) {
                        $category = PurchaseItemsModel::find($pid);
                        
                        if ($category) {
                            // Update the existing category
                            $category->plateid = $categoryIds[$index];
                            $category->materialtype = $materialtype[$index];
                            $category->rmaterial = $rmaterial[$index];
                            $category->qty = $qtys[$index];
                            $category->save();
                            
                            // Check if qty is not equal to 0 or empty
                            // if ($qtys[$index] != 0 && $qtys[$index] != "") {
                            //     // Update location in ScanModel
                            //     $scanModel = SubplateModel::where('id', $categoryIds[$index])->first();
                            //     if ($scanModel) {
                            //         // Update the location
                            //         $scanModel->location = $model->vendorid;
                            //         $scanModel->save();
                            //     }
                            // }
                        } 
                    } else {
                        // Create a new category
                        $newCategory = new PurchaseItemsModel();
                        $newCategory->plateid = $categoryIds[$index];
                        $newCategory->pid = $purid[$index];
                        $newCategory->materialtype = $materialtype[$index];
                        $newCategory->rmaterial = $rmaterial[$index];
                        $newCategory->qty = $qtys[$index];
                        $newCategory->save();
                        // if ($qtys[$index] != 0 && $qtys[$index] != "") {
                        //     // Update location in ScanModel
                        //     $scanModel = SubplateModel::where('id', $categoryIds[$index])
                        //                           ->first();
                        //     if ($scanModel) {
                        //         // Update the location
                        //         $scanModel->location = $model->vendorid;
                        //         $scanModel->save();
                        //     }
                        // }
                    }
                    
                   // else{
        
                   // }
                   }
                }  
        }else{
        $purchase=new PurchaseModel();
        $purchase->odate=Carbon::createFromFormat('d/m/Y', $request->input('odate'))->format('Y-m-d');
        $purchase->vname=$request->input('vname');
        $purchase->cname=$request->input('cname');
        // $purchase->subplateid=$request->input('subplateid');
        $purchase->projectid=$request->input('projectid');
        $purchase->created_by = Auth::user()->name;
        // $purchase->materialtype=$request->input('materialtype'); 
        // $purchase->rmaterial=$request->input('rmaterial');
        // $purchase->qty=$request->input('qty');
                // Check if there are any entries in PurchaseModel for the given projectid.
        // $datac = PurchaseModel::select('*')->get();
        // $existingEntry = PurchaseModel::where('projectid', $request->input('projectid'))->first();
        // if ($datac->isEmpty()) {
        //     $purchase->purchaseid = 1;
        //     if ( $purchase->purchaseid < 99) {
        //         $purchase->pno = "PO-00" .  $purchase->purchaseid;
        //     } else {
        //         $purchase->pno = "PO-" .  $purchase->purchaseid;
        //     }
        // } 
        // elseif(!$existingEntry) {
        //     $maxPno = PurchaseModel::max('purchaseid');
        //     $purchase->purchaseid = $maxPno + 1;
        //     if ( $purchase->purchaseid < 99) {
        //         $purchase->pno = "PO-00" .  $purchase->purchaseid;
        //     } else {
        //         $purchase->pno = "PO-" .  $purchase->purchaseid;
        //     }
        // } 
        // else{
        //     if($existingEntry){
        //         $purchase->purchaseid = $existingEntry->purchaseid;
        //         if ( $purchase->purchaseid < 99) {
        //             $purchase->pno = "PO-00" .  $purchase->purchaseid;
        //         } else {
        //             $purchase->pno = "PO-" .  $purchase->purchaseid;
        //         }
        //     }
        // }
        // $datac = PurchaseModel::select('*')->get();
        // $purchaseid = $datac->count() + 1;
        // if ($purchaseid < 99) {
        //     $purchase->srno = "SM-00" . $purchaseid;
        // } else {
        //     $purchase->srno = "SM-" . $purchaseid;
        // }
       
        $datac = PurchaseModel::select('*')->get();
        if ($datac->isEmpty()) {
            $purchase->purchaseid = 1010;
            $purchase->srno = "PO-1010";
        } else {
            $maxPno = PurchaseModel::max('purchaseid');
            $purchase->purchaseid = $maxPno + 1;
            $purchase->srno = "PO-" . $purchase->purchaseid;
        }
        
        $purchase->save();
            $pids = $request->input('pids', []);
            $purid = $request->input('pid', []);
            $categoryIds = $request->input('categories', []);
            // $descriptions = $request->input('cdescription', []);
            $materialtypes = $request->input('materialtype', []);
            $materials = $request->input('material', []);
            $qtys = $request->input('qty', []);
            if ((count($categoryIds) == count($materialtypes)) && (count($categoryIds) == count($materials)) && (count($categoryIds) == count($qtys))) {
                foreach ($categoryIds as $index => $categoryId) {
                    $categoryId = explode(",", $categoryId)[0];
                    $materialtype = $materialtypes[$index];
                    $material = $materials[$index];
                    $qty = $qtys[$index];
    
                    $purchase->categories()->attach($categoryId, [
                        'materialtype' => $materialtype,
                        'material'=> $material,
                        'qty' => $qty,
                        'pid' => $purchase->id,
                    ]);  
                } 
            }
        }
        return redirect()->back()->with('success', 'Purchase created/updated successfully!');
    }
    // public function exportpurchasedata(Request $request)
    // {
    //     $data = PurchaseModel::where('status', '1')->get();

    //     // Extracting pid from the first result, assuming there's only one result
    //     $pid = $data->isEmpty() ? null : $data->first()->pid;

    //     $childDatas = PurchaseItemsModel::leftJoin('subplate', 'purchase_items.plateid', '=', 'subplate.id')
    //         ->select('purchase_items.*', 'subplate.platename')
    //         ->where('pid', '=', $pid)
    //         ->get();

    //     $arrays = [$data, $childDatas];
    //     return Excel::download($arrays, 'test.xlsx');
    // }
    
    
    
    

    public function getPitems(Request $request)
    {
        //write a code to get subplates from projectid 
        // $plates = ChallanItemsModel::where('challanid','=',$request->challanid)->get();
        // return response()->json($plates);

        $plateData = PurchaseItemsModel::leftJoin('subplate', 'purchase_items.plateid', '=', 'subplate.id')
        ->select('purchase_items.*', 'subplate.platename')
        ->where('pid','=',$request->pid)
        ->get();

        // $platenames  = ScanningModel::join('subplate', 'scan.id', '=', 'subplate.projectid')
        // ->select('subplate.id','subplate.platename', 'subplate.subprojectid')
        // ->where('scan.projectid', $request->projectid)
        // ->get();
        //     $plates = ChallanItemsModel::where('challanid', '=', $request->challanid)
        //     ->with('subplate') // eager load the subplate relationship
        //     ->get();
        
        // $plateData = $plates->map(function ($plate) {
        //     return [
        //         'challan_item' => $plate,
        //         'plate_name' => $plate->subplate->platename,
        //     ];
        // });
        
        return response()->json([
            'plateData' => $plateData,
            // 'platenames' => $platenames
        ]);
    }
    public function getPRitems(Request $request)
    {
        //write a code to get subplates from projectid 
        // $plates = ChallanItemsModel::where('challanid','=',$request->challanid)->get();
        // return response()->json($plates);

        $plateData = PurchaseInwardItemsModel::leftJoin('subplate', 'purchase_inward_items.plateid', '=', 'subplate.id')
        ->select('purchase_inward_items.*', 'subplate.platename')
        ->where('pid','=',$request->pid)
        ->get();

        $platenames  = ScanningModel::join('subplate', 'scan.id', '=', 'subplate.projectid')
        ->select('subplate.id','subplate.platename', 'subplate.subprojectid')
        ->where('scan.projectid', $request->projectid)
        ->get();
        //     $plates = ChallanItemsModel::where('challanid', '=', $request->challanid)
        //     ->with('subplate') // eager load the subplate relationship
        //     ->get();
        
        // $plateData = $plates->map(function ($plate) {
        //     return [
        //         'challan_item' => $plate,
        //         'plate_name' => $plate->subplate->platename,
        //     ];
        // });
        
        return response()->json([
            'plateData' => $plateData,
            'platenames' => $platenames
        ]);
    }
public function purchaselist()
    {
        $purchasedata = ViewPurchaseModel::select('id','srno')->where('pending_qty','!=', 0)->groupBy('id','srno')->get();
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $data = CustomerModel::latest()->where('usertype','Vendor')->get();
        $datacus = CustomerModel::latest()->where('usertype','Customer')->get();
        return view('purchase.purchaselist',["currentDateTime"=>$currentDateTime,"data"=>$data,"datacus"=>$datacus,"purchasedata" => $purchasedata]);
    }
    public function destroy($id)
    {
        //
        $model=PurchaseModel::where("id", $id)->update(["status" => "0"]);
      
        return redirect()->back();
    }
}
