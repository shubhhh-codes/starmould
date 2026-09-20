<?php

namespace App\Http\Controllers;

use App\Models\ChallanItemsModel;
use App\Models\ChallanModel;
use App\Models\CustomerModel;
use App\Models\SubplateModel;
use App\Models\ScanningModel;
use App\Models\ViewModel;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Carbon\Carbon;
use Yajra\DataTables\DataTables as DataTables;

class ChallanController extends Controller
{
    /**
     * Display a listing of the resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function index(Request $request)
    {
        //
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $data = CustomerModel::latest()->where('usertype','Vendor')->get();
        $datacus = CustomerModel::latest()->where('usertype','Customer')->get();
        $datavendor = CustomerModel::latest()->where('usertype','Transport')->get();
     //   $chdata = SubplateModel::select('id','platename')->get();
        return view('challan.index',["currentDateTime"=>$currentDateTime,"data"=>$data, "datavendor"=>$datavendor,"datacus"=>$datacus]);
        
    }
    public function outwardlist()
    {
        $challandata = ViewModel::select('id','challanno')->where('pending_qty','!=', 0)->groupBy('id','challanno')->get();
        $currentDateTime = Carbon::now()->format('d/m/Y');
        $data = CustomerModel::latest()->where('usertype','Vendor')->get();
        $datacus = CustomerModel::latest()->where('usertype','Customer')->get();
        $datavendor = CustomerModel::latest()->where('usertype','Transport')->get();
        return view('challan.outwardlist',["currentDateTime"=>$currentDateTime,"data"=>$data, "datavendor"=>$datavendor,"datacus"=>$datacus,"challandata" => $challandata]);
    }
    public function Vendornamemobile(Request $request){
        $data = CustomerModel::select('id','customername')->where('usertype','Vendor')->get();
        return response()->json(['status'=>true, 'data'=>$data], 200);
    }
    public function Transporternamemobile(Request $request){
        $data = CustomerModel::select('id','customername')->where('usertype','Transport')->get();
        return response()->json(['status'=>true, 'data'=>$data], 200);
    }
    public function indexmobile(Request $request)
    {
        // $data = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')->select('challan.*','customers.customername')->where('status','1')->get();
        $data = ChallanModel::leftJoin('customers', 'challan.customerid', '=', 'customers.id')
        ->leftJoin('customers AS vendor', 'challan.vendorid', '=', 'vendor.id')
        ->leftJoin('customers AS transporter', 'challan.vendortid', '=', 'transporter.id')
        ->select('challan.*', 'customers.customername', 'vendor.customername AS vendorname','transporter.customername AS transportername')
        ->where('status', '1')
        ->get();
        return response()->json(['status'=>true,'data' => $data], 200);
    }
   
    public function printlist(Request $request)
    {
        //$cdata = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')->select('challan.*','customers.customername','customers.mobile','customers.mobile1')->where('status','1')->where('challan.id',$request->challan)->get();
        $cdata = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        ->leftJoin('challan_items', 'challan.id', '=', 'challan_items.challanid')
        ->leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        ->select('challan.*', 'customers.customername', 'customers.mobile', 'customers.mobile1', 'subplate.platename', 'challan_items.plateid')
        ->where('status', '1')
        ->where('challan.id', $request->challan)
        ->get();

        // $cdata = ChallanModel::leftJoin('customers', 'challan.vendorid', '=', 'customers.id')
        // ->leftJoin('challan_items', 'challan.id', '=', 'challan_items.challan_id')
       
        // ->select('challan.*', 'customers.customername', 'customers.mobile', 'customers.mobile1', 'subplate.platename')
        // ->where('status', '1')
        // ->where('challan.id', $request->challan)
        // ->get();
        foreach ($cdata as $challan) {
            $carbonDate = Carbon::createFromFormat('Y-m-d', $challan->chdate);
            $formattedDate = $carbonDate->format('d/m/Y');
            $formattedDates[] = $formattedDate;
        }
       
        // $cdata = ChallanModel::where('status','1')->get();
        return view('challan.printlist',["request"=>$request,"cdata"=>$cdata,"formattedDate"=>$formattedDate]);
    }
    public function getData(Request $request)
    {
        if ($request->ajax()) {
            $start = $request->input('start', 0); // Get the start index of the pagination
            $length = $request->input('length', 100); // Get the length of data to be fetched

            $query = ChallanModel::where('status','1')->orderBy('id','DESC');
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
            ->addColumn('vendorid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vendorid)->get();
                $vendorid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vendorid=$value->customername;
                    }  
                }
                return $vendorid;
            }) 

            ->filterColumn('vendorid', function($query, $keyword) {
                $query->whereHas('vendor', function($q) use ($keyword) {
                    $q->where('customername', 'like', "%$keyword%");
                });
            }) 


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
            ->addColumn('action', function($row){
                
                $chdate = Carbon::parse($row->chdate);
                $row->chdate=$chdate->format('d/m/Y');
                // $btn = '<a href="javascript:Edit(\''.(str_replace("\"","\\'",json_encode($row,true))).'\')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Edit</a>';
                   $btn = '<a href="javascript:AskToDelete(\''.$row->id.'\')" class="btn btn-outline-danger waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;">Delete</a>';
                   $btn.= '<a href="'.route("challan2",['challan'=>$row->id]).'" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;" target="_blank">View</a>';
                   $btn.= '<a href="'.route("challanimage",['challan'=>$row->id]).'" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1" style="padding: 1px; padding-right: 10px;padding-left: 10px;" target="_blank">image</a>';
             
                   return $btn;
            })
            ->rawColumns(['action'])
            ->make(true);
          //  return $data;                          
        }
    }
    public function getCData(Request $request)
    {
        if ($request->ajax()) {
            // $data = ChallanModel::where('status','1')->get();
            $data = ViewModel::where('pending_qty','!=', 0)->groupBy('id')->get(); 
            // $data = UserModel::latest()->get();
            // DB::table('users')->where('name', 'John')->first();
            return DataTables::of($data)
            ->addIndexColumn()  
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
            ->addColumn('vendorid',function($row){
                $data1 = CustomerModel::latest()->where("id",$row->vendorid)->get();
                $vendorid="";
                if($data1->count()>0){
                    foreach ($data1 as $key => $value) {
                        # code...
                        $vendorid=$value->customername;
                    }  
                }
                return $vendorid;
            }) 
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
            ->addColumn('challanno1', function($row) {
                $link = route('challan2', ['challan' => $row->id]);
                return '<a href="' . $link . '" target="_blank" style="color: #5277e9 !important;">' . $row->challanno . '</a>';
            })
            ->addColumn('inward', function($row){
                $chdate = Carbon::parse($row->chdate);
                $row->chdate=$chdate->format('d/m/Y');
                $row->platename=str_replace("\"","<>",$row->platename);
                $btn = '<a class="btn btn-outline-primary waves-effect waves-light btn-sm" style="padding: 1px; padding-right: 10px;padding-left: 10px;" href="javascript:View(' . htmlspecialchars(json_encode(str_replace("'", "\'", $row), JSON_UNESCAPED_UNICODE), ENT_QUOTES, 'UTF-8') . ')" class="btn btn-outline-primary waves-effect waves-light btn-sm me-1">inward</a>';
                  return $btn;
            })
            ->rawColumns(['challanno1','inward'])
            ->make(true);
          //  return $data;                          
        }
    }
    /**
     * Show the form for creating a new resource.
     *
     * @return \Illuminate\Http\Response
     */
    public function getCitemsmobile(Request $request){
        try
        {
            $plateData = ChallanItemsModel::leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
            ->leftJoin('customers', 'challan_items.customer', '=', 'customers.id')
            ->leftJoin('scan', 'subplate.projectid', '=', 'scan.id')
            ->select('challan_items.*', 'subplate.platename','customers.customername','scan.description')
            ->where('challanid','=',$request->challanid)
            ->get();
            // $platenames  = ScanningModel::join('subplate', 'scan.id', '=', 'subplate.projectid')
            // ->select('subplate.id','subplate.platename', 'subplate.subprojectid')
            // ->where('scan.projectid', $request->projectid)
            // ->get();
            
            return response()->json(['status'=>true,'message'=>"Data updated successfully",'plateData' => $plateData], 200); 
        }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       }
    }
    public function getCitems(Request $request){
        //write a code to get subplates from projectid 
        // $plates = ChallanItemsModel::where('challanid','=',$request->challanid)->get();
        // return response()->json($plates);

        $plateData = ChallanItemsModel::leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        ->leftJoin('customers', 'challan_items.customer', '=', 'customers.id')
        ->leftJoin('scan', 'subplate.projectid', '=', 'scan.id')
        ->select('challan_items.*', 'subplate.platename', 'customers.customername','scan.description')
        ->where('challanid','=',$request->challanid)
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
    public function getCLitemsmobile(Request $request){
        try
        {
            $plateData = ChallanItemsModel::leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
            ->select('challan_items.*', 'subplate.platename','subplate.location')
            ->where('challanid','=',$request->challanid)
            ->where('subplate.location','<>','SM')
            ->get();
            // $platenames  = ScanningModel::join('subplate', 'scan.id', '=', 'subplate.projectid')
            // ->select('subplate.id','subplate.platename', 'subplate.subprojectid')
            // ->where('scan.projectid', $request->projectid)
            // ->get();
            return response()->json(['status'=>true,'message'=>"Data updated successfully",'plateData' => $plateData], 200); 
        }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       }
    }
    public function getCLitems(Request $request){
        //write a code to get subplates from projectid 
        // $plates = ChallanItemsModel::where('challanid','=',$request->challanid)->get();
        // return response()->json($plates);

        $plateData = ChallanItemsModel::leftJoin('subplate', 'challan_items.plateid', '=', 'subplate.id')
        ->leftJoin('customers', 'challan_items.customer', '=', 'customers.id')
        ->select('challan_items.*', 'subplate.platename','subplate.location', 'customers.customername')
        ->where('challan_items.challanid','=',$request->challanid)
        ->where('subplate.location','<>','SM')
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
    public function create()
    {
        //
    }

    /**
     * Store a newly created resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @return \Illuminate\Http\Response
     */
    public function addchallan(Request $request)
    {
        try
        {
            
                $challan = new ChallanModel();
                $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
                $challan->customerid = $request->input('customerid');
                $challan->vendorid = $request->input('vendorid');
                $challan->vendortid = $request->input('vendortid');
                $challan->projectid = $request->input('projectid');
                $challan->created_by = Auth::user()->name;
        
                $datac = ChallanModel::select('*')->get();
                $challnid = $datac->count() + 1;
        
                if ($challnid < 10) {
                    $challan->challanno = "SM/JW/0" . $challnid;
                } else {
                    $challan->challanno = "SM/JW/" . $challnid;
                }
        
                $challan->save();
                $customers = $request->input('customer', []);
                $projectids = $request->input('project', []);
                $categoryIds = $request->input('categories', []);
                $particulars = $request->input('particulars', []);
                $qtys = $request->input('qty', []);
        
                if ((count($categoryIds) === count($particulars)) && (count($categoryIds) === count($qtys)) && (count($categoryIds) === count($customers))) {
                    foreach ($categoryIds as $index => $categoryId) {
                        $categoryId = $categoryIds[$index];
                        $particular = $particulars[$index];
                        $qty = $qtys[$index];
                        $customer = $customers[$index];
                        $project = $projectids[$index];
                        $challan->categories()->attach($categoryId, [
                            'particulars' => $particular,
                            'qty' => $qty,
                            'challanid' => $challan->id,
                            'customer' => $customer,
                            'project' => $project,
                        ]);
        
                        if ($qty != 0 && $qty !== "") {
                            // Update location in ScanModel
                            $scanModel = SubplateModel::where('id', $categoryId)->first();
                            $sc = CustomerModel::select('initials')->where('id', $challan->vendorid)->first();  

                            if ($sc) { // Ensure $sc is not null before accessing its properties
                                $existingInitials = explode(',', $scanModel->location);
                                $smFound = in_array('SM', $existingInitials);
                                $scInitialsFound = in_array($sc->initials, $existingInitials);
                            
                                if ($sc->initials === 'SM' || $smFound || $scInitialsFound) {
                                    $scanModel->location = $sc->initials;
                                } else {
                                    $existingInitials[] = $sc->initials;
                                    $scanModel->location = implode(',', $existingInitials);
                                }
                            
                                $scanModel->save();
                            }
                        }
                        
                    }
                } else {
                    return redirect()->back()->with('error', 'Number of categories, particulars, and quantities do not match.');
                }
                return redirect()->back()->with('success', 'Challan created/updated successfully!');
             
        }
        catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       }
    }
  
    public function addCPlatesmobile(Request $request){
        try {
            if($request->id!=""){
            $model = ChallanItemsModel::find($request->id);
             // Update the existing category
             $model->plateid = $request->plateid;
             $model->challanid = $request->challanid;
             // $category->cdescription = $descriptions[$index];
             $model->particulars = $request->particulars;
             $model->qty = $request->qty;
             $model->save();
            return response()->json(['status'=>true,'message'=>"Data updated successfully"], 200);          
            } 
            else 
            {
             // Create a new category
            $model = new ChallanItemsModel();
            $model->plateid = $request->plateid;
            $model->challanid = $request->challanid;
            // $newCategory->cdescription = $descriptions[$index];
            $model->particulars = $request->particulars;
            $model->qty = $request->qty;
            $model->save();
            return response()->json(['status'=>true,'message'=>"Data inserted successfully "], 200);
            }
         
              
        }catch(\Illuminate\Database\QueryException $ex)
        { 
            $error="Something went wrong. Try after sometime.";
            foreach ($ex->getPrevious()->errorInfo as $key => $value) {
                # code...
                if(strlen($value)>7){
                    $error=$value;
                }
            }
                return response()->json(['status'=>false,'message' => $error], 200);
                // 
        }
    }
//     public function store(Request $request)
// {
     
//     // Create a new Challan model and populate its attributes
//     $challan = new ChallanModel();
//     $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
//     $challan->vendorid = $request->input('vendorid');
//     $challan->projectid = $request->input('projectid');
//    // $challan->vendorid = $request->input('vendorid');
//     $datac = ChallanModel::select('*')->get();
//     $challnid=$datac->count()+1;
//     $challan->challanno="OW_".$challnid;
//     // $challan->cdescription = $request->input('cdescription');
//     // $challan->particulars = $request->input('particulars');
//   //  $challan->qty = $request->input('qty');

//     // Save the Challan model to the database
//     $challan->save();

//     // Process the categories
//     $categoryIds = $request->input('categories', []);
//     $descriptions = $request->input('cdescription', []);
//     $particulars = $request->input('particulars', []);
//     $qtys = $request->input('qty', []);
//     // foreach ($categoryIds as $categoryId) {
//     //     $challan->categories()->attach($challan->id, [
//     //         'particulars' => $request->input('particulars'),
//     //         'cdescription' => $request->input('cdescription'),
//     //         'plateid' => $categoryId,
//     //         'challanid'=>$challan->id
//     //     ]);
//     //     //$challan->categories()->attach($challan->id, ['plateid' => $categoryId,'challanid'=>$challan->id]);
//     // }


//     if ((count($categoryIds) == count($descriptions)) && (count($categoryIds) == count($particulars)) && (count($categoryIds) == count($qtys))) {
//         foreach ($categoryIds as $index => $categoryId) {
//             $description = $descriptions[$index]; // Get the corresponding description
//             $particular = $particulars[$index];
//             $qty = $qtys[$index];
//             $challan->categories()->attach($categoryId, [
//                 'particulars' => $particular,
//                 'cdescription' => $description,
//                 'qty' => $qty,
//                 'challanid'=>$challan->id,
//             ]);
//         }
//     } else {
//         // Handle the case where the number of categories and descriptions do not match
//         // This could indicate an issue with the input data
//         return redirect()->back()->with('error', 'Number of categories and descriptions do not match.');
//     }
    

//     // if (count($categoryIds) === count($descriptions)) {
//     //     foreach ($categoryIds as $index => $categoryId) {
//     //         $description = $descriptions[$index]; // Get the corresponding description

//     //         $challan->categories()->attach($challan->id, [
//     //             'particulars' => $request->input('particulars'),
//     //             'cdescription' => $description,
//     //             'plateid' => $categoryId,
//     //             'challanid'=>$challan->id
//     //         ]);
//     //     }
//     // } else {
//     //     // Handle the case where the number of categories and descriptions do not match
//     //     // This could indicate an issue with the input data
//     //     return redirect()->back()->with('error', 'Number of categories and descriptions do not match.');
//     // }
//     // Optionally, you can redirect the user to a success page or show a success message
//     return redirect()->back()->with('success', 'Challan created successfully!');
// }

// public function store(Request $request)
// {
//     //dd($request);
//     if ($request->id != "") {
//         // Find the existing Challan model
//         $challan = ChallanModel::findOrFail($request->id);
    
//         // Update the Challan attributes
//         $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
//         $challan->vendorid = $request->input('vendorid');
//         $challan->vendortid = $request->input('vendortid');
//         $challan->projectid = $request->input('projectid');
//         $challan->created_by = Auth::user()->name;
    
//         // Save the updated Challan model to the database
//         $challan->save();
    
//         // Process the updated categories
    
//         $pids = $request->input('pids', []);
//         $challanid = $request->input('challanid', []);
        
//         $categoryIds = $request->input('categories', []);
//         // $descriptions = $request->input('cdescription', []);
//         $particulars = $request->input('particulars', []);
//         $qtys = $request->input('qty', []);
    
//         // Iterate over each row in the repeater
//         if ((count($categoryIds) == count($particulars)) && (count($categoryIds) == count($qtys))) {
//         foreach ($pids as $index => $pid) {
//             if ($pid != "" && $pid!=null) {
//                 $category = ChallanItemsModel::find($pid);
                
//                 if ($category) {
//                     // Update the existing category
//                     $category->plateid = $categoryIds[$index];
//                     // $category->cdescription = $descriptions[$index];
//                     $category->particulars = $particulars[$index];
//                     $category->qty = $qtys[$index];
//                     $category->save();
//                 } 
//             } else {
//                 // Create a new category
//                 $newCategory = new ChallanItemsModel();
//                 $newCategory->plateid = $categoryIds[$index];
//                 $newCategory->challanid = $challanid[$index];
//                 // $newCategory->cdescription = $descriptions[$index];
//                 $newCategory->particulars = $particulars[$index];
//                 $newCategory->qty = $qtys[$index];
//                 $newCategory->save();
//             }
//            // else{

//            // }
//            }
//         }  
//     } else {
//                 // Create a new Challan model and populate its attributes
//     $challan = new ChallanModel();
//     $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
//     $challan->vendorid = $request->input('vendorid');
//     $challan->vendortid = $request->input('vendortid');
//     $challan->projectid = $request->input('projectid');
//     $challan->created_by = Auth::user()->name;
//    // $challan->vendorid = $request->input('vendorid');
   
//     $datac = ChallanModel::select('*')->get();
//     $challnid=$datac->count()+1;
//     // $challan->challanno="SM/JW/".$challnid;
//     if ($challnid < 10) {
//         $challan->challanno = "SM/JW/0" . $challnid;
//     } else {
//         $challan->challanno = "SM/JW/" . $challnid;
//     }
//     // $challan->cdescription = $request->input('cdescription');
//     // $challan->particulars = $request->input('particulars');
//   //  $challan->qty = $request->input('qty');

//     // Save the Challan model to the database
//     $challan->save();

//     // Process the categories
//     $categoryIds = $request->input('categories', []);
//     // $descriptions = $request->input('cdescription', []);
//     $particulars = $request->input('particulars', []);
//     $qtys = $request->input('qty', []);
//     // foreach ($categoryIds as $categoryId) {
//     //     $challan->categories()->attach($challan->id, [
//     //         'particulars' => $request->input('particulars'),
//     //         'cdescription' => $request->input('cdescription'),
//     //         'plateid' => $categoryId,
//     //         'challanid'=>$challan->id
//     //     ]);
//     //     //$challan->categories()->attach($challan->id, ['plateid' => $categoryId,'challanid'=>$challan->id]);
//     // }


//     if ((count($categoryIds) == count($particulars)) && (count($categoryIds) == count($qtys))) {
//         foreach ($categoryIds as $index => $categoryId) {
//             // $description = $descriptions[$index]; // Get the corresponding description
//             $categoryId=explode(",",$categoryId)[0];
//             $particular = $particulars[$index];
//             $qty = $qtys[$index];
//             $challan->categories()->attach($categoryId, [
//                 'particulars' => $particular,
//                 // 'cdescription' => $description,
//                 'qty' => $qty,
//                 'challanid'=>$challan->id,
//             ]);
//         }
//     } else {
//         // Handle the case where the number of categories and descriptions do not match
//         // This could indicate an issue with the input data
//         return redirect()->back()->with('error', 'Number of categories and descriptions do not match.');
//     }
    
//             }
//             // if ($categoryId != "") {
//             //     // Update the existing category
//             //     $challan->categories()->updateExistingPivot($categoryId, [
//             //         'cdescription' => $description,
//             //         'particulars' => $particular,
//             //         'qty' => $qty,
//             //     ]);
//             //} 
//             // else {
//             //     // Add a new category
//             //     $category = new CategoryModel([
//             //         'cdescription' => $description,
//             //         'particulars' => $particular,
//             //         'qty' => $qty,
//             //     ]);
    
//             //     // Save the category and attach it to the Challan model
//             //     $challan->categories()->save($category, ['pid' => $pid]);
//             // }
       
//     return redirect()->back()->with('success', 'Challan created/updated successfully!');
// }
public function store(Request $request)
{
    //dd($request);
    if ($request->id != "") {
        // Find the existing Challan model
        $challan = ChallanModel::findOrFail($request->id);
    
        // Update the Challan attributes
        $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
        $challan->customerid = $request->input('customerid');
        $challan->vendorid = $request->input('vendorid');
        $challan->vendortid = $request->input('vendortid');
        $challan->projectid = $request->input('projectid');
        $challan->created_by = Auth::user()->name;
    
        // Save the updated Challan model to the database
        $challan->save();
    
        // Process the updated categories
    
        $pids = $request->input('pids', []);
        $challanid = $request->input('challanid', []);
        $customer = $request->input('customer', []);
        $project = $request->input('project', []);
        $categoryIds = $request->input('categories', []);
        // $descriptions = $request->input('cdescription', []);
        $particulars = $request->input('particulars', []);
        $qtys = $request->input('qty', []);
    
        // Iterate over each row in the repeater
        if ((count($categoryIds) == count($particulars)) && (count($categoryIds) == count($qtys)) && (count($categoryIds) == count($customer))) {
        foreach ($pids as $index => $pid) {
            if ($pid != "" && $pid != null) {
                $category = ChallanItemsModel::find($pid);
                
                if ($category) {
                    // Update the existing category
                    $category->plateid = $categoryIds[$index];
                    $category->customer = $customer[$index];
                    $category->project = $project[$index];
                    $category->particulars = $particulars[$index];
                    $category->qty = $qtys[$index];
                    $category->save();
                    
                    // Check if qty is not equal to 0 or empty
                    if ($qtys[$index] != 0 && $qtys[$index] != "") {
                        // Update location in ScanModel
                        $scanModel = SubplateModel::where('id', $categoryIds[$index])->first();
                        if ($scanModel) {
                            // Update the location
                            $scanModel->location = $challan->vendorid;
                            $scanModel->save();
                        }
                    }
                } 
            } else {
                // Create a new category
                $newCategory = new ChallanItemsModel();
                $newCategory->plateid = $categoryIds[$index];
                $newCategory->challanid = $challanid[$index];
                $newCategory->customer = $customer[$index];
                $newCategory->project = $project[$index];
                $newCategory->particulars = $particulars[$index];
                $newCategory->qty = $qtys[$index];
                $newCategory->save();
                if ($qtys[$index] != 0 && $qtys[$index] != "") {
                    // Update location in ScanModel
                    $scanModel = SubplateModel::where('id', $categoryIds[$index])
                                          ->first();
                    if ($scanModel) {
                        // Update the location
                        $scanModel->location = $challan->vendorid;
                        $scanModel->save();
                    }
                }
            }
            
           // else{

           // }
           }
        }  
    } else 
    {
        $challan = new ChallanModel();
        $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
        $challan->customerid = $request->input('customerid');
        $challan->vendorid = $request->input('vendorid');
        $challan->vendortid = $request->input('vendortid');
        $challan->projectid = $request->input('projectid');
        $challan->created_by = Auth::user()->name;

        $datac = ChallanModel::select('*')->get();
        $challnid = $datac->count() + 1;

        if ($challnid < 10) {
            $challan->challanno = "SM/JW/0" . $challnid;
        } else {
            $challan->challanno = "SM/JW/" . $challnid;
        }

        $challan->save();
        $customers = $request->input('customer', []);
        $projectids = $request->input('project', []);
        $categoryIds = $request->input('categories', []);
        $particulars = $request->input('particulars', []);
        $qtys = $request->input('qty', []);

        if ((count($categoryIds) === count($particulars)) && (count($categoryIds) === count($qtys)) && (count($categoryIds) === count($customers))) {
            foreach ($categoryIds as $index => $categoryId) {
                $categoryId = explode(",", $categoryId)[0];
                $particular = $particulars[$index];
                $qty = $qtys[$index];
                $customer = $customers[$index];
                $project = $projectids[$index];
                $challan->categories()->attach($categoryId, [
                    'particulars' => $particular,
                    'qty' => $qty,
                    'challanid' => $challan->id,
                    'customer' => $customer,
                    'project' => $project,
                ]);
                // if ($qty != 0 && $qty != "") {
                //     // Update location in ScanModel
                //     $scanModel = SubplateModel::where('id', $categoryId)
                //                           ->first();
                //     if ($scanModel) {
                //         // Update the location
                //         $sc = CustomerModel::select('initials')->where('id', $challan->vendorid)->first();
                //             if(($scanModel->location == 'SM') || ($scanModel->location != $sc->initials)){
                //                 $scanModel->location = $sc->initials; 
                //                 $scanModel->save();
                //             }
                //             else{
                //                 $newLocation = $scanModel->location ? $scanModel->location . ',' . $sc->initials : $sc->initials;
                //                 $scanModel->location = $newLocation;
                //                 $scanModel->save();   
                //             }  
                //         // $scanModel->location = $sc->initials; 
                //         // $scanModel->save();
                //     }
                // }



                // $newLocation = $scanModel->location ? $scanModel->location . ',' . $sc->initials : $sc->initials;
                //                 $scanModel->location = $newLocation;
                //                 $scanModel->save();
                                
               
                if ($qty != 0 && $qty !== "") {
                    // Update location in ScanModel
                    $scanModel = SubplateModel::where('id', $categoryId)->first();
                    if ($scanModel) {
                        $sc = CustomerModel::select('initials')->where('id', $challan->vendorid)->first();  
                        // Convert the location string to an array of initials
                        $existingInitials = explode(',', $scanModel->location);
                
                        // Check if 'SM' is present in the array
                        $smFound = in_array('SM', $existingInitials);
                
                        // Check if $sc->initials is present in the array
                        $scInitialsFound = in_array($sc->initials, $existingInitials);
                
                        if ($sc->initials === 'SM' || $smFound || $scInitialsFound) {
                            // If the new value is 'SM', or 'SM' or $sc->initials are already present, update the location to $sc->initials
                            $scanModel->location = $sc->initials;
                        } else {
                            // If $sc->initials is not present, add it to the array
                            $existingInitials[] = $sc->initials;
                            // Update the location to the imploded initials
                            $scanModel->location = implode(',', $existingInitials);
                        }
                
                        $scanModel->save();
                    }
                }
                
            }
        } else {
            return redirect()->back()->with('error', 'Number of categories, particulars, and quantities do not match.');
        }
    }
    /*  old code for challan_items*/
    // {
    //                 // Create a new Challan model and populate its attributes
    //     $challan = new ChallanModel();
    //     $challan->chdate = Carbon::createFromFormat('d/m/Y', $request->input('chdate'))->format('Y-m-d');
    //     $challan->vendorid = $request->input('vendorid');
    //     $challan->vendortid = $request->input('vendortid');
    //     $challan->projectid = $request->input('projectid');
    //     $challan->created_by = Auth::user()->name;
    //    // $challan->vendorid = $request->input('vendorid');
    
    //     $datac = ChallanModel::select('*')->get();
    //     $challnid=$datac->count()+1;
    //     // $challan->challanno="SM/JW/".$challnid;
    //     if ($challnid < 10) {
    //         $challan->challanno = "SM/JW/0" . $challnid;
    //     } else {
    //         $challan->challanno = "SM/JW/" . $challnid;
    //     }
    //     // $challan->cdescription = $request->input('cdescription');
    //     // $challan->particulars = $request->input('particulars');
    //   //  $challan->qty = $request->input('qty');

    //     // Save the Challan model to the database
    //     $challan->save();

    //     // Process the categories
    //     // $categoryIds = $request->input('categories', []);
    //     // $categoryIds = $request->input('categories', [])[0];
    //     $categoryIds = explode(",", $request->input('categories', ''));

    //     // $descriptions = $request->input('cdescription', []);
    //     $particulars = $request->input('particulars', []);
    //     $qtys = $request->input('qty', []);
    //     // foreach ($categoryIds as $categoryId) {
    //     //     $challan->categories()->attach($challan->id, [
    //     //         'particulars' => $request->input('particulars'),
    //     //         'cdescription' => $request->input('cdescription'),
    //     //         'plateid' => $categoryId,
    //     //         'challanid'=>$challan->id
    //     //     ]);
    //     //     //$challan->categories()->attach($challan->id, ['plateid' => $categoryId,'challanid'=>$challan->id]);
    //     // }


    //     if ((count($categoryIds) == count($particulars)) && (count($categoryIds) == count($qtys))) {
    //         foreach ($categoryIds as $index => $categoryId) {
    //             // $description = $descriptions[$index]; // Get the corresponding description
    //             $categoryId=explode(",",$categoryId)[0];
    //             $particular = $particulars[$index];
    //             $qty = $qtys[$index];
    //             $challan->categories()->attach($categoryId, [
    //                 'particulars' => $particular,
    //                 // 'cdescription' => $description,
    //                 'qty' => $qty,
    //                 'challanid'=>$challan->id,
    //             ]);
    //         }
    //     } else {
    //         // Handle the case where the number of categories and descriptions do not match
    //         // This could indicate an issue with the input data
    //         return redirect()->back()->with('error', 'Number of categories and descriptions do not match.');
    //     }
        
    // }
            
    return redirect()->back()->with('success', 'Challan created/updated successfully!');
}

    // public function store(Request $request)
    // {
    //     //
    //     if($request->id!=""){
    //         $model=ChallanModel::findOrFail($request->id);
    //         $model->chdate=Carbon::createFromFormat('d/m/Y', $request->chdate)->format('Y-m-d');
    //         $model->vendorid=$request->vendorid;
    //         $model->cdescription=$request->cdescription;
    //         $model->particulars=$request->particulars;
    //         $model->qty=$request->qty;
    //         $model->save();
    //        }
    //        else{
    //                 $model=new ChallanModel();
    //                 $model->chdate=Carbon::createFromFormat('d/m/Y', $request->chdate)->format('Y-m-d');
    //                 $model->vendorid=$request->vendorid;
    //                 $model->cdescription=$request->cdescription;
    //                 $model->particulars=$request->particulars;
    //                 $model->qty=$request->qty;
    //                 $model->save();
    //             }
    //             return redirect(route('challanlist'));
    // }
    /**
     * Display the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function show($id)
    {
        //
    }

    /**
     * Show the form for editing the specified resource.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function edit($id)
    {
        //
    }

    /**
     * Update the specified resource in storage.
     *
     * @param  \Illuminate\Http\Request  $request
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    public function update(Request $request, $id)
    {
        //
    }

    /**
     * Remove the specified resource from storage.
     *
     * @param  int  $id
     * @return \Illuminate\Http\Response
     */
    
    public function destroy($id)
    {

       
            
        $challanItems = ChallanItemsModel::join('challan', 'challan_items.challanid', '=', 'challan.id')
        ->where('challan.id', $id)
        ->select('challan_items.plateid')
        ->get();

        foreach ($challanItems as $challanItem) {
            $plateid = $challanItem->plateid;
            $scanModel = SubplateModel::where('id', $plateid)->first();
            $customerInitials = CustomerModel::join('challan', 'customers.id', '=', 'challan.vendorid')
                ->where('challan.id', $id)
                ->select('customers.initials')
                ->first();

            // Convert the location string to an array of initials
            $existingInitials = explode(',', $scanModel->location);

            // Check if 'SM' is present in the array
            $smFound = in_array('SM', $existingInitials);

            // Check if the value to be replaced is present in the array
            
            $key = array_search($customerInitials->initials, $existingInitials);
            if ($key !== false) {
                // If 'SM' is not in the list, replace 'BA' with 'SM'
                if (!$smFound) {
                    $existingInitials[$key] = 'SM';
                } else {
                    // If 'SM' is already in the list, just remove 'BA'
                    unset($existingInitials[$key]);
                }
                // Update the location to the imploded initials
                $scanModel->location = implode(',', $existingInitials);
                $scanModel->save(); // Save the updated location for each plate
            }
        }

    
        $model=ChallanModel::where("id", $id)->update(["status" => "0"]);
        
      
        return redirect(route('challanlist'));
    }
    public function deletechallan(Request $request)
    {
        //
        try
        {   
            $model=ChallanModel::where("id", $request->id)->update(["status" => "0"]);
            return response()->json(['status'=>true,'message' => "Challan deleted successfully."], 200);
       } 
       catch(\Illuminate\Database\QueryException $ex)
       { 
           $error="Something went wrong. Try after sometime.";
           foreach ($ex->getPrevious()->errorInfo as $key => $value) {
               # code...
               if(strlen($value)>7){
                   $error=$value;
               }
           }
               return response()->json(['status'=>false,'message' => $error], 200);
               // Note any method of class PDOException can be called on $ex.
       } 
    }
}
